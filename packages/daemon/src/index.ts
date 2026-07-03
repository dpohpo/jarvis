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
import { mkdirSync, readFileSync } from "node:fs";
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
  randomId,
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
import { pcm16ToWav } from "./voice/wav.js";
import { ensureAsrSidecar, synthesizeAny, transcribeAny } from "./voice/local.js";
import { route, type Turn } from "./brain/router.js";

// load ~/.jarvis/env (KEY=value lines) before reading any config
try {
  const envFile = join(homedir(), ".jarvis", "env");
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
  }
} catch {
  // no env file — fine
}

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
ensureAsrSidecar();

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

/** Fire-and-forget voice-family send: own stream seq, kind:"voice", no outbox. */
function sendVoiceTo(deviceId: string, payload: Payload): void {
  const keys = peerKeys(deviceId);
  if (!keys) return;
  relay.send(
    sealPayload(payload, {
      room,
      from: state.deviceId,
      to: deviceId,
      kind: "voice",
      peer: keys,
    }),
  );
}

// ---- voice sessions ---------------------------------------------------------

const voiceBuffers = new Map<string, Uint8Array[]>();
/** Rolling conversation history keyed by sessionId (NOT deviceId).
 *  This ensures each session has its own brain context — Session 3
 *  doesn't see what was said in Session 1. SessionId is extracted
 *  from cmdId (format: "sessionId::randomSuffix"). */
const chatHistory = new Map<string, Turn[]>();

function remember(deviceId: string, role: Turn["role"], content: string): void {
  const h = chatHistory.get(deviceId) ?? [];
  h.push({ role, content });
  chatHistory.set(deviceId, h.slice(-20));
}

/** 16kHz/22kHz mono PCM16 WAV → playback ms, straight from the header. */
function wavDurationMs(wav: Uint8Array): number {
  if (wav.length < 44) return 0;
  const v = new DataView(wav.buffer, wav.byteOffset);
  const byteRate = v.getUint32(28, true);
  return byteRate > 0 ? Math.round(((wav.length - 44) / byteRate) * 1000) : 0;
}

async function speakTo(
  deviceId: string,
  text: string,
  opts?: { expectReply?: boolean },
): Promise<void> {
  try {
    const wav = await synthesizeAny(text);
    if (!wav) return;
    sendVoiceTo(deviceId, {
      t: "tts.start",
      seq: 0,
      mime: "audio/wav",
      durationMs: wavDurationMs(wav),
      expectReply: opts?.expectReply ?? false,
    });
    const CHUNK = 48 * 1024;
    let seq = 0;
    for (let off = 0; off < wav.length; off += CHUNK) {
      seq += 1;
      sendVoiceTo(deviceId, {
        t: "tts.chunk",
        seq,
        data: Buffer.from(wav.subarray(off, off + CHUNK)).toString("base64"),
      });
    }
    sendVoiceTo(deviceId, { t: "tts.end", seq: seq + 1 });
    log(`tts → ${deviceId}: ${wav.length} bytes in ${seq} chunks`);
  } catch (e) {
    log(`tts failed: ${String(e)}`);
  }
}

async function handleVoiceEnd(from: string): Promise<void> {
  const parts = voiceBuffers.get(from) ?? [];
  voiceBuffers.delete(from);
  const total = parts.reduce((n, p) => n + p.length, 0);
  if (total < 3200) {
    // <0.1s of audio — accidental tap
    return;
  }
  const pcm = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    pcm.set(p, off);
    off += p.length;
  }
  log(`voice from ${from}: ${(total / 32000).toFixed(1)}s audio, transcribing…`);
  try {
    const text = await transcribeAny(pcm16ToWav(pcm));
    if (!text) {
      sendTo(from, { t: "asr.final", seq: 0, text: "" });
      void speakTo(from, "抱歉，我没有听清。", { expectReply: true });
      return;
    }
    sendTo(from, { t: "asr.final", seq: 0, text });
    const sk = currentSession.get(from) ?? from;
    remember(sk, "user", text);

    // brain: clean + decide in one call (graceful: falls back to direct task)
    const decision = await route(text, chatHistory.get(sk) ?? []);
    log(`brain: ${decision.action}${decision.task ? ` task='${decision.task.slice(0, 60)}'` : ""}`);

    if (decision.action === "answer" || decision.action === "clarify") {
      remember(sk, "assistant", decision.reply);
      // Encode sessionId in cmdId so phone routes reply to correct session.
      sendTo(from, {
        t: "task.event",
        seq: 0,
        taskId: `chat-${randomId().slice(0, 8)}`,
        cmdId: `${sk}::${randomId()}`,
        ev: "done",
        data: decision.reply,
        ts: Date.now(),
      });
      await speakTo(from, decision.reply, {
        expectReply: decision.action === "clarify",
      });
      return;
    }

    // task: short spoken ack first, then execute with spoken result
    remember(sk, "assistant", decision.reply || "好的。");
    void speakTo(from, decision.reply || "好的，这就去办。");
    enqueueCmd({
      from,
      cmdId: `${sk}::${randomId()}`,
      text: decision.task || text,
      opts: { voiceReply: true },
    });
  } catch (e) {
    log(`asr failed: ${String(e)}`);
    void speakTo(from, "语音识别出错了。");
  }
}

// ---- task execution (serial queue, one at a time) --------------------------

interface QueueItem {
  from: string;
  cmdId: string;
  text: string;
  workdir?: string;
  opts?: { voiceReply?: boolean };
  /** Assigned when the task actually starts; lets stop target a queued item. */
  taskId: string;
}

const cmdQueue: QueueItem[] = [];
let active: { taskId: string; from: string; kill: () => void } | null = null;
let draining = false;
/** taskIds the user asked to stop before they even started running. */
const cancelled = new Set<string>();
/** Per-device Claude Code session_id for --resume. Set by /history slash. */
const currentResumeSession = new Map<string, string>();
/** Per-device current sessionId (for voice path that has no cmdId). */
const currentSession = new Map<string, string>();

/** Extract sessionId from cmdId (format: "sessionId::randomSuffix").
 *  Falls back to deviceId for backward compat. */
function sessionKey(cmdId: string | undefined, deviceId: string): string {
  if (cmdId) {
    const parts = cmdId.split("::");
    if (parts.length >= 2) return parts[0] as string;
  }
  return currentSession.get(deviceId) ?? deviceId;
}

/**
 * Slash-command fast path.
 *
 * Phone app sends /rename /delete /workspace.create /provider.set
 * /workspace.switch /history /clear as cmd.submit text. We intercept
 * here and execute locally on the daemon, never reaching the Claude
 * Code executor. Returns true if handled (don't enqueue), false to
 * fall through to the executor (regular prompt or unknown slash).
 *
 * Replies are sent back as task.event output (kind:"output") so they
 * appear in the chat surface exactly like a normal assistant message.
 */
async function handleSlash(text: string, from: string, cmdId: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return false;
  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0] ?? "";
  const args = parts.slice(1);
  const argstr = trimmed.slice(1 + cmd.length).trim();

  const reply = (msg: string) => {
    sendTo(from, {
      t: "task.event",
      seq: 0,
      ev: "output",
      taskId: `slash-${cmdId}`,
      data: msg,
      ts: Date.now(),
    });
    // Mark the synthetic slash task done so the phone's BusyBanner clears.
    sendTo(from, {
      t: "task.event",
      seq: 0,
      ev: "done",
      taskId: `slash-${cmdId}`,
      data: cmd,
      ts: Date.now(),
    });
  };

  switch (cmd) {
    case "rename": {
      // /rename <oldName> <newName...>
      const oldName = args[0];
      const newName = argstr.split(/\s+/).slice(1).join(" ");
      if (!oldName || !newName) {
        reply("Usage: /rename <oldName> <newName>");
        return true;
      }
      // Daemon-side: we don't have a workspace registry (yet), but log it.
      log(`[slash] rename ${oldName} → ${newName}`);
      reply(`Renamed "${oldName}" → "${newName}" (local note; agent rename persisted by app).`);
      return true;
    }
    case "delete": {
      const name = args[0];
      if (!name) {
        reply("Usage: /delete <name>");
        return true;
      }
      log(`[slash] delete ${name}`);
      reply(`Deleted "${name}" (local note; agent delete persisted by app).`);
      return true;
    }
    case "workspace.create": {
      // /workspace.create <name> <engine> <spawnMode>
      const [name, engine, spawnMode] = args;
      if (!name) {
        reply("Usage: /workspace.create <name> [engine] [spawnMode]");
        return true;
      }
      log(`[slash] workspace.create ${name} engine=${engine ?? "claude"} mode=${spawnMode ?? "spawn"}`);
      reply(`Workspace "${name}" created (engine=${engine ?? "claude"}, mode=${spawnMode ?? "spawn"}).`);
      return true;
    }
    case "workspace.switch": {
      const name = args[0];
      if (!name) {
        reply("Usage: /workspace.switch <name>");
        return true;
      }
      log(`[slash] workspace.switch ${name}`);
      reply(`Switched to workspace "${name}".`);
      return true;
    }
    case "provider.set": {
      // /provider.set <provider> <model> <mode>
      const [provider, model, mode] = args;
      if (!provider) {
        reply("Usage: /provider.set <provider> [model] [mode]");
        return true;
      }
      log(`[slash] provider.set ${provider} ${model ?? ""} ${mode ?? ""}`);
      reply(`Provider set: ${provider}/${model ?? "default"}/${mode ?? "code"}.`);
      return true;
    }
    case "history": {
      // /history <agentId> — switch current agent context + set resume session
      const agentId = args[0];
      if (!agentId) return true; // silent no-op
      log(`[slash] history → switch to agent ${agentId}`);
      // Set current session so voice path + brain history use this agent.
      currentSession.set(from, agentId);
      // subsequent cmd.submit can `--resume` that session.
      try {
        const dbPath = `${process.env.HOME}/.jarvis/agents.sqlite`;
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare("SELECT session_id FROM agents WHERE id = ?").get(agentId) as { session_id?: string } | undefined;
        db.close();
        if (row?.session_id) {
          currentResumeSession.set(from, row.session_id);
          log(`[slash] history → resume session ${row.session_id}`);
        } else {
          currentResumeSession.delete(from);
        }
      } catch { /* sqlite query failed — first submit will create new session */ }
      return true;
    }
    case "clear": {
      // /clear — phone-side clears chat, daemon just acknowledges.
      reply("Chat cleared.");
      return true;
    }
    default:
      // Unknown slash — let the executor see it (agent might answer /help etc.)
      return false;
  }
}

/** Enqueue a command. Runs immediately if idle, otherwise queues (FIFO). */
function enqueueCmd(item: Omit<QueueItem, "taskId">): string {
  const taskId = ulid();
  const full: QueueItem = { ...item, taskId };
  cmdQueue.push(full);
  const ahead = cmdQueue.length - 1 + (active ? 1 : 0);
  if (ahead > 0) {
    sendTo(item.from, {
      t: "task.event",
      seq: 0,
      taskId,
      cmdId: item.cmdId,
      ev: "progress",
      data: `已排队（前面还有 ${ahead} 个任务）`,
      ts: Date.now(),
    });
  }
  void drainQueue();
  return taskId;
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  while (cmdQueue.length) {
    const item = cmdQueue.shift()!;
    if (cancelled.delete(item.taskId)) continue; // stopped while queued
    await runOneCmd(item);
  }
  draining = false;
}

/** Stop a specific task (running or queued), or everything if taskId omitted. */
function stopTask(taskId?: string): void {
  if (!taskId) {
    cmdQueue.forEach((q) => cancelled.add(q.taskId));
    cmdQueue.length = 0;
    if (active) active.kill();
    log("stop: killed active + cleared queue");
    return;
  }
  if (active?.taskId === taskId) {
    active.kill();
    log(`stop: killed active task ${taskId}`);
  } else if (cmdQueue.some((q) => q.taskId === taskId)) {
    cancelled.add(taskId);
    log(`stop: cancelled queued task ${taskId}`);
  }
}

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

async function runOneCmd(item: QueueItem): Promise<void> {
  const { from, cmdId, text, workdir, opts, taskId } = item;
  const wd = workdir ?? state.workdir;
  // Extract sessionId from cmdId for per-session brain history isolation.
  const sk = sessionKey(cmdId, from);

  // Phase 15-v7: route through the brain (GLM) for clean + decide, even for
  // typed text submits. Mirrors what the voice path already does, so typed
  // prompts also benefit from:
  //   - ASR-like cleanup (typos, ambiguous shorthand → clean intent)
  //   - Direct answer for "what's X?" style questions (no need to spawn
  //     Claude Code for a knowledge question — saves time + money)
  //   - Clarifying-question branch when intent is ambiguous
  // Memory: chatHistory is keyed by device id so each phone keeps its own
  // rolling context. brain router pulls ~/.jarvis/dict.json internally for
  // domain term correction (e.g. user-specific jargon, project names).
  // Slash commands (text starting with /) bypass the brain entirely —
  // those are pure client-control signals handled by handleSlash().
  let finalText = text;
  let brainShortCircuit: null | { reply: string; expectReply: boolean } = null;
  if (!text.trim().startsWith("/")) {
    const history = chatHistory.get(sk) ?? [];
    try {
      const decision = await route(text, history);
      log(`brain: ${decision.action}${decision.task ? ` task='${decision.task.slice(0, 60)}'` : ""}`);
      remember(sk, "user", text);

      if (decision.action === "answer" || decision.action === "clarify") {
        remember(sk, "assistant", decision.reply);
        store.create(taskId, text.slice(0, 120), wd);
        store.setStatus(taskId, "done");
        store.addEvent(taskId, "done", decision.reply);
        sendTo(from, {
          t: "task.event", seq: 0, taskId, cmdId,
          ev: "done", data: decision.reply, ts: Date.now(),
        });
        if (opts?.voiceReply) {
          void speakTo(from, decision.reply, {
            expectReply: decision.action === "clarify",
          });
        }
        return;
      }

      // task: show cleaned prompt to user for confirmation BEFORE executing.
      // The brain cleaned the raw ASR/text into a self-contained instruction.
      // We send it to the phone as a perm.request so the user sees exactly
      // what will be dispatched to Claude Code and can approve or reject.
      finalText = decision.task || text;
      remember(sk, "assistant", decision.reply || "好的。");
      if (opts?.voiceReply && decision.reply) {
        void speakTo(from, decision.reply);
      }

      // --- confirmation gate (always, for brain-routed tasks) ---
      store.create(taskId, finalText.slice(0, 120), wd);
      store.setStatus(taskId, "waiting_approval");
      const confirmReqId = ulid();
      const confirmSummary = `确认执行：${finalText.slice(0, 120)}`;
      sendTo(from, {
        t: "perm.request", seq: 0,
        reqId: confirmReqId, taskId,
        tier: 3,
        summary: confirmSummary,
        detail: finalText,
        timeoutSec: 120,
        onTimeout: "deny",
      });
      // Also TTS-speak the cleaned prompt so voice users hear it.
      void speakTo(from, `我理解你要：${finalText.slice(0, 200)}。确认执行吗？`, { expectReply: true });

      const userConfirmed = await approvals.wait(confirmReqId, 120);
      if (!userConfirmed) {
        store.setStatus(taskId, "error");
        store.addEvent(taskId, "error", "任务未确认，已取消。");
        sendTo(from, {
          t: "task.event", seq: 0, taskId, cmdId,
          ev: "error", data: "任务未确认，已取消。", ts: Date.now(),
        });
        if (opts?.voiceReply) void speakTo(from, "好的，取消执行。");
        return;
      }
      // User approved — proceed to classifyCommand + execute.
      store.setStatus(taskId, "running");
      // --- end confirmation gate ---
    } catch (e) {
      log(`brain route failed, falling back to direct task: ${String(e)}`);
      // Don't remember or short-circuit — fall through to direct execution.
    }
  }

  const verdict = classifyCommand(finalText, wd);
  store.create(taskId, finalText.slice(0, 120), wd);
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
  let task;
  try {
    task = runClaudeCode({
      prompt: finalText,
      workdir: wd,
      resumeSessionId: currentResumeSession.get(from),
      onSessionId: (sid) => {
        store.setAgentSession(taskId, sid);
        currentResumeSession.set(from, sid);
      },
      onEvent: (e) => emit(e.ev, e.data),
    });
  } catch (e) {
    // Spawn failure (e.g. claude binary missing, Sequoia SIGKILL, ENOSYS).
    // Don't crash the daemon — report to the phone so the user sees the error
    // and can retry, then mark the task as failed.
    const msg = String(e instanceof Error ? e.message : e);
    log(`[runOneCmd] spawn failed: ${msg}`);
    emit("error", `daemon spawn failed: ${msg.slice(0, 200)}`);
    store.setStatus(taskId, "error");
    return;
  }
  active = { taskId, from, kill: task.kill };
  let ok = false;
  let result = "";
  try {
    const r = await task.done;
    ok = r.ok;
    result = r.result;
  } catch (e) {
    // Task itself threw (post-spawn) — e.g. daemon shutdown mid-run.
    result = String(e instanceof Error ? e.message : e);
    ok = false;
  }
  active = null;
  store.setStatus(taskId, ok ? "done" : "error");
  if (opts?.voiceReply) {
    const spoken = ok ? result || "完成了。" : `出错了：${result.slice(0, 200)}`;
    remember(sk, "assistant", `[任务结果] ${spoken.slice(0, 300)}`);
    void speakTo(from, spoken, { expectReply: true });
  }
}

// ---- payload routing --------------------------------------------------------

async function handlePayload(from: string, payload: Payload): Promise<void> {
  // voice family bypasses the reliable channel entirely
  switch (payload.t) {
    case "voice.start":
      voiceBuffers.set(from, []);
      return;
    case "voice.chunk": {
      const buf = voiceBuffers.get(from);
      if (buf) buf.push(new Uint8Array(Buffer.from(payload.data, "base64")));
      return;
    }
    case "voice.end":
      void handleVoiceEnd(from);
      return;
    default:
      break;
  }

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
      // Slash-command fast path: messages beginning with / are intercepted
      // here and never reach the Claude Code executor. This gives the phone
      // app control over session/workspace state without needing a new
      // protocol payload type. Unknown / commands fall through to the
      // executor as a regular prompt (so the agent can answer /help).
      if (await handleSlash(payload.text, from, payload.cmdId)) {
        break;
      }
      enqueueCmd({ from, cmdId: payload.cmdId, text: payload.text, workdir: payload.workdir });
      break;
    case "task.stop":
      stopTask(payload.taskId);
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
