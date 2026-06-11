/**
 * Jarvis daemon — the body (and later the brain) on the Mac.
 *
 * MVP scope: pairing, encrypted relay link, cmd.submit → Claude Code headless,
 * task.event streaming back, Tier-3 approval round-trip, task persistence.
 *
 * Admin interface on 127.0.0.1 only: `pair` tokens and status for the local CLI.
 */
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import WebSocket from "ws";
import { ulid } from "ulid";
import {
  Ack,
  type Envelope,
  HelloPayload,
  Outbox,
  Inbox,
  PairRequest,
  type Payload,
  RelayClient,
  type TaskSummary,
  bytesToUtf8,
  cryptoReady,
  fromB64,
  openPayload,
  sealPayload,
  sealOpen,
  toB64,
  utf8ToBytes,
  boxTo,
} from "@jarvis/protocol/node";
import {
  addDevice,
  consumePairToken,
  issuePairToken,
  loadOrCreateState,
  roomOf,
  saveState,
  type DaemonState,
} from "./identity.js";
import { TaskStore } from "./tasks/store.js";
import { runClaudeCode } from "./executors/claude-code.js";
import { ApprovalBroker, classifyCommand } from "./approval.js";

const RELAY_URL = process.env.JARVIS_RELAY_URL ?? "ws://127.0.0.1:8787";
const ADMIN_PORT = Number(process.env.JARVIS_ADMIN_PORT ?? 8788);
const DEFAULT_WORKDIR =
  process.env.JARVIS_WORKDIR ?? join(homedir(), "JarvisRemoteControl");

await cryptoReady();
mkdirSync(DEFAULT_WORKDIR, { recursive: true });

const state: DaemonState = loadOrCreateState(RELAY_URL, DEFAULT_WORKDIR);
const room = roomOf(state);
const store = new TaskStore();
store.markOrphans();
const approvals = new ApprovalBroker();

const log = (msg: string) => console.log(`[daemon] ${msg}`);

// ---- per-peer reliable channel state -------------------------------------

interface PeerChannel {
  outbox: Outbox<Payload>;
  inbox: Inbox;
}
const channels = new Map<string, PeerChannel>();

function channelFor(deviceId: string): PeerChannel {
  let ch = channels.get(deviceId);
  if (!ch) {
    ch = { outbox: new Outbox<Payload>(state.channelSeqs?.[deviceId] ?? 0), inbox: new Inbox() };
    channels.set(deviceId, ch);
  }
  return ch;
}

function peerKeys(deviceId: string) {
  const dev = state.devices.find((d) => d.deviceId === deviceId);
  if (!dev) return null;
  return {
    theirBoxPublic: fromB64(dev.boxPub),
    myBoxPrivate: fromB64(state.boxPriv),
  };
}

/** Encrypt + send a seq-numbered payload to a paired device (buffered for replay). */
function sendTo(deviceId: string, payload: Payload & { seq: number }): void {
  const keys = peerKeys(deviceId);
  if (!keys) return;
  const ch = channelFor(deviceId);
  payload.seq = ch.outbox.add(payload);
  state.channelSeqs = { ...state.channelSeqs, [deviceId]: payload.seq };
  saveState(state);
  const env = sealPayload(payload, {
    room,
    from: state.deviceId,
    to: deviceId,
    peer: keys,
  });
  relay.send(env);
}

function broadcast(payloadOf: () => Payload & { seq: number }): void {
  for (const dev of state.devices) sendTo(dev.deviceId, payloadOf());
}

// ---- task execution --------------------------------------------------------

const running = new Map<string, { kill: () => void }>();

function taskSummaries(): TaskSummary[] {
  return store.list().map((t) => ({
    taskId: t.taskId,
    status: t.status,
    title: t.title,
    workdir: t.workdir,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

async function handleCmd(from: string, cmdId: string, text: string, workdir?: string): Promise<void> {
  const wd = workdir ?? state.workdir;
  const verdict = classifyCommand(text, wd);
  const taskId = ulid();
  store.create(taskId, text.slice(0, 120), wd);
  log(`cmd ${cmdId} → task ${taskId} (tier ${verdict.tier}: ${verdict.reason})`);

  const emit = (ev: Parameters<typeof store.addEvent>[1], data: string) => {
    store.addEvent(taskId, ev, data);
    sendTo(from, { t: "task.event", seq: 0, taskId, cmdId, ev: ev as never, data, ts: Date.now() });
  };

  if (verdict.tier === 3) {
    const reqId = ulid();
    store.setStatus(taskId, "waiting_approval");
    emit("progress", `等待审批: ${verdict.reason}`);
    sendTo(from, {
      t: "perm.request",
      seq: 0,
      reqId,
      taskId,
      tier: 3,
      summary: text.slice(0, 80),
      detail: `原因: ${verdict.reason}\n完整指令: ${text}\n工作目录: ${wd}`,
      timeoutSec: 300,
      onTimeout: "deny",
    });
    const allowed = await approvals.wait(reqId, 300);
    if (!allowed) {
      store.setStatus(taskId, "paused");
      emit("error", "审批被拒绝或超时（默认拒绝）。任务已暂停。");
      return;
    }
  } else if (verdict.tier === 2) {
    emit("progress", `Tier 2 操作，已自动执行并通知: ${verdict.reason}`);
  }

  store.setStatus(taskId, "running");
  const task = runClaudeCode({
    prompt: text,
    workdir: wd,
    onSessionId: (sid) => store.setAgentSession(taskId, sid),
    onEvent: (e) => emit(e.ev, e.data),
  });
  running.set(taskId, task);
  const { ok } = await task.done;
  running.delete(taskId);
  store.setStatus(taskId, ok ? "done" : "error");
}

// ---- payload routing --------------------------------------------------------

function handlePayload(from: string, payload: Payload): void {
  const ch = channelFor(from);
  if ("seq" in payload && payload.t !== "hello") {
    if (!ch.inbox.accept(payload.seq)) return; // duplicate
  }

  switch (payload.t) {
    case "hello": {
      const resumeFrom = payload.resumeFrom ?? ch.inbox.ackValue;
      for (const { item } of ch.outbox.since(resumeFrom)) {
        const keys = peerKeys(from);
        if (!keys) break;
        relay.send(
          sealPayload(item, { room, from: state.deviceId, to: from, peer: keys }),
        );
      }
      log(`hello from ${from}, replayed from seq ${resumeFrom}`);
      break;
    }
    case "ack":
      ch.outbox.ackUpTo(payload.upTo);
      break;
    case "cmd.submit":
      void handleCmd(from, payload.cmdId, payload.text, payload.workdir);
      break;
    case "perm.response":
      if (!approvals.settle(payload.reqId, payload.decision === "allow")) {
        log(`stale perm.response for ${payload.reqId}`);
      }
      break;
    case "task.list":
      sendTo(from, { t: "task.state", seq: 0, tasks: taskSummaries() });
      break;
    default:
      log(`unhandled payload ${payload.t} from ${from}`);
  }
}

function handlePairEnvelope(env: Envelope): void {
  const plain = sealOpen(env.box, fromB64(state.boxPub), fromB64(state.boxPriv));
  if (!plain) return log("pair envelope failed to open");
  const parsed = PairRequest.safeParse(JSON.parse(bytesToUtf8(plain)));
  if (!parsed.success) return log("bad pair request schema");
  const req = parsed.data;
  if (!consumePairToken(state, req.token)) {
    return log(`pair rejected for ${env.from}: bad/expired token`);
  }
  addDevice(state, {
    deviceId: env.from,
    name: req.deviceName,
    boxPub: req.boxPub,
    signPub: req.signPub,
    pairedAt: Date.now(),
  });
  log(`✅ paired device ${env.from} (${req.deviceName})`);
  sendTo(env.from, {
    t: "pair.accept",
    daemonName: state.deviceId,
    deviceId: env.from,
  } as never);
}

// ---- relay link --------------------------------------------------------------

const relay = new RelayClient({
  url: RELAY_URL,
  deviceId: state.deviceId,
  room,
  signPublicB64: state.signPub,
  signPrivate: fromB64(state.signPriv),
  makeWebSocket: (url) => new WebSocket(url) as never,
  log: (m) => log(`relay: ${m}`),
  onEnvelope: (env) => {
    if (env.kind === "pair") return handlePairEnvelope(env);
    const keys = peerKeys(env.from);
    if (!keys) return log(`envelope from unknown device ${env.from} — dropped`);
    const payload = openPayload(env, keys);
    if (!payload) return log(`undecryptable envelope from ${env.from} — dropped`);
    handlePayload(env.from, payload);
  },
  onUp: () => log(`link up (room ${room.slice(0, 8)}…)`),
});
relay.start();

// ---- local admin (127.0.0.1 only) --------------------------------------------

const admin = createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method === "POST" && req.url === "/pair") {
    const token = issuePairToken(state);
    res.end(
      JSON.stringify({
        relayUrl: state.relayUrl,
        room,
        daemonDeviceId: state.deviceId,
        daemonBoxPub: state.boxPub,
        token,
      }),
    );
    return;
  }
  if (req.url === "/status") {
    res.end(
      JSON.stringify({
        deviceId: state.deviceId,
        room: room.slice(0, 8) + "…",
        relayUp: relay.isUp,
        devices: state.devices.map((d) => ({ id: d.deviceId, name: d.name })),
        tasks: taskSummaries().slice(0, 10),
      }),
    );
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
admin.listen(ADMIN_PORT, "127.0.0.1", () => {
  log(`admin on 127.0.0.1:${ADMIN_PORT}, relay ${RELAY_URL}, workdir ${state.workdir}`);
  log(`paired devices: ${state.devices.length}`);
});
