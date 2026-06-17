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
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import WebSocket from "ws";
import { ulid } from "ulid";
import {
  Ack,
  type Envelope,
  type EngineInfo,
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
import { runCodex, findCodexBin } from "./executors/codex.js";
import {
  createAgentManager,
  reconcileAgents,
  readClaudeHistory,
  createAgent as agentsCreate,
  listAgents as agentsList,
  getAgent as agentsGet,
  deleteAgent as agentsDelete,
  agentSendKey,
} from "./agents/manager.js";
import { runTmuxInject } from "./executors/tmux-inject.js";
import { detectTmuxPanes, tmuxAvailable } from "./executors/tmux-detect.js";
import { ApprovalBroker, classifyCommand } from "./approval.js";
import { pcm16ToWav } from "./voice/wav.js";
import { ensureAsrSidecar, synthesizeAny, transcribeAny } from "./voice/local.js";
import { route, type Turn } from "./brain/router.js";
import { reloadIfStale } from "./brain/dict.js";
import {
  deleteMemory,
  getAllSettings,
  getAllWorkspaceConfigs,
  getWorkspaceConfig,
  listMemory,
  setSetting,
  setWorkspaceConfig,
  setWorkspaceSessionId,
  updateMemory,
} from "./brain/storage.js";
import { existsSync } from "node:fs";

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
if (state.activeWorkspace == null) state.activeWorkspace = "";
const room = roomOf(state);
const store = new TaskStore();
store.markOrphans();
const approvals = new ApprovalBroker();
ensureAsrSidecar();

// ---- agent manager (Phase G) -----------------------------------------------
// Forward-declared; wired up after `sendTo` / `broadcast` are defined below.
let agentManager_spawn: (agentId: string, text: string, from: string, backend?: "tmux" | "spawn") => { ok: boolean; reason?: string } = () => ({ ok: false, reason: "not initialized" });
let agentManager_stop: (agentId: string) => boolean = () => false;
let agentManager_listForPush: () => Array<{ id: string; workspace: string; engine: "claude" | "codex"; session_id?: string; title: string; created_at: number; last_active: number; status: "idle" | "running" | "done" | "error"; cwd: string; message_count: number }> = () => [];
let agentManager_sendKey: (agentId: string, key: string) => boolean = () => false;

// ---- session stickiness (attach-like behaviour) ----------------------------
// Per-workdir cache of the most recent Claude Code session id, so consecutive
// voice turns in the same workspace resume the prior conversation instead of
// starting cold. Rebuilt from TaskStore on daemon start; updated live by the
// onSessionId callback in runOneCmd().
//
// Trade-off: scope is workdir only (not per-device or per-workspace-slug).
// Multiple devices sharing one workspace will collide on the same session —
// acceptable for now, since Claude Code's jsonl format itself doesn't support
// concurrent writers either.
const lastSessionByWorkdir = new Map<string, string>();
for (const t of store.list(100)) {
  if (t.agentSessionId && !lastSessionByWorkdir.has(t.workdir)) {
    lastSessionByWorkdir.set(t.workdir, t.agentSessionId);
  }
}
if (lastSessionByWorkdir.size > 0) {
  console.log(`[daemon] session: resumed ${lastSessionByWorkdir.size} workdir→sessionId binding(s) from history`);
}

// ---- workspace management ---------------------------------------------------
// Workspaces are first-level subdirectories of state.workdir. The empty string
// means "workdir root" (the historical default). Active workspace survives
// daemon restarts via state.activeWorkspace in daemon.json.

/** All workspace names = sorted subdirectory names of workdir. */
function listWorkspaces(): string[] {
  try {
    return readdirSync(state.workdir)
      .filter((name) => {
        const p = join(state.workdir, name);
        return !name.startsWith(".") && statSync(p).isDirectory();
      })
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Resolve the directory the next task runs in. Per-command override wins. */
function currentWorkdir(): string {
  const ws = state.activeWorkspace ?? "";
  return ws ? join(state.workdir, ws) : state.workdir;
}

/** Resolve a workspace name (or "" for root) to an absolute cwd. */
function resolveWsCwd(wsName: string): string {
  const trimmed = (wsName ?? "").trim();
  return trimmed ? join(state.workdir, trimmed) : state.workdir;
}

/** Switch the active workspace, creating it if missing. Empty name = root. */
function switchWorkspace(name: string): string {
  const trimmed = name.trim();
  state.activeWorkspace = trimmed;
  if (trimmed) mkdirSync(join(state.workdir, trimmed), { recursive: true });
  saveState(state);
  log(`workspace: active='${trimmed || "<root>"}'`);
  return trimmed;
}

/** Push the current workspace state to every paired phone. */
function broadcastWorkspaceState(): void {
  broadcast(() => ({
    t: "workspace.state",
    seq: 0,
    active: state.activeWorkspace ?? "",
    workspaces: listWorkspaces(),
  }));
}

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

// ---- agent manager wiring (after sendTo / broadcast exist) -----------------
{
  const mgr = createAgentManager({
    taskStore: store,
    resolveCwd: resolveWsCwd,
    broadcast: (make) => broadcast(() => make() as Payload & { seq: number }),
    sendTo: (to, make) => sendTo(to, make() as Payload & { seq: number }),
    log,
  });
  agentManager_spawn = mgr.spawn;
  agentManager_stop = mgr.stop;
  agentManager_sendKey = agentSendKey;
  agentManager_listForPush = () =>
    agentsList().map((a) => ({
      id: a.id,
      workspace: a.workspace,
      engine: a.engine,
      ...(a.session_id ? { session_id: a.session_id } : {}),
      title: a.title,
      created_at: a.created_at,
      last_active: a.last_active,
      status: a.status as "idle" | "running" | "done" | "error",
      cwd: a.cwd,
      message_count: a.message_count,
    }));
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
/** Rolling conversation history per device (for the brain router). */
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
    remember(from, "user", text);

    // Pick up dict edits without a daemon restart. The brain router reads the
    // current vocabulary list when buildSystemPrompt() runs (next line).
    reloadIfStale();

    // brain: clean + decide in one call. The router's system prompt carries
    // the user's vocabulary list, so the LLM itself corrects STT mishearings
    // (English short tokens → Chinese homophones, slash-prefixed skill names,
    // proper nouns) using pronunciation + context. No deterministic replace.
    const decision = await route(text, chatHistory.get(from) ?? [], listWorkspaces());
    log(`brain: ${decision.action}${decision.task ? ` task='${decision.task.slice(0, 60)}'` : ""}${decision.workspace ? ` ws='${decision.workspace}'` : ""}`);

    if (decision.action === "workspace") {
      // Validate the LLM-picked name; fall back to clarify if it doesn't exist.
      // Empty string is always valid (= root workdir).
      const want = decision.workspace.trim();
      const available = listWorkspaces();
      if (want && !available.includes(want)) {
        // LLM hallucinated a name. Surface the closest matches so the user
        // can pick the right one next turn.
        await speakTo(from, `没有叫「${want}」的工作空间。可用:${available.join("、")}`, {
          expectReply: true,
        });
        return;
      }
      switchWorkspace(want);
      const displayName = want || "主目录";
      remember(from, "assistant", decision.reply || `已切换到 ${displayName}`);
      broadcast(() => ({
        t: "workspace.state",
        seq: 0,
        active: state.activeWorkspace ?? "",
        workspaces: available,
      }));
      await speakTo(from, decision.reply || `已切换到 ${displayName}`, { expectReply: true });
      return;
    }

    if (decision.action === "answer" || decision.action === "clarify") {
      remember(from, "assistant", decision.reply);
      sendTo(from, {
        t: "task.event",
        seq: 0,
        taskId: `chat-${randomId().slice(0, 8)}`,
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
    remember(from, "assistant", decision.reply || "好的。");
    void speakTo(from, decision.reply || "好的，这就去办。");

    // Surface the cleaned/normalized task instruction on the phone so the
    // user can see exactly what was dispatched to Claude Code — including any
    // vocabulary corrections the LLM applied (e.g. "必海天" → "/bht").
    const taskId = ulid();
    const cmdId = randomId();
    sendTo(from, {
      t: "task.event",
      seq: 0,
      taskId,
      cmdId,
      ev: "output",
      data: `📋 ${decision.task}`,
      ts: Date.now(),
    });

    enqueueCmd({
      from,
      cmdId,
      taskId,
      text: decision.task || text,
      opts: { voiceReply: true },
    });
  } catch (e) {
    const msg = String(e);
    // The catch wraps ASR + brain route + action dispatch. ASR errors and
    // brain errors need different user-facing messages — otherwise a GLM
    // rate-limit (1305) misleads the user into thinking their mic/STT is
    // broken when the transcript was actually fine.
    if (msg.includes("glm") || msg.includes("1305") || msg.includes("JARVIS_ZHIPU")) {
      log(`brain failed: ${msg}`);
      void speakTo(from, "AI 思考太忙了，请稍后再试。");
    } else if (msg.includes("GLM-ASR") || msg.includes("local asr") || msg.includes("transcribe")) {
      log(`asr failed: ${msg}`);
      void speakTo(from, "语音识别出错了。");
    } else {
      log(`handleVoiceEnd failed: ${msg}`);
      void speakTo(from, "内部出错了，请稍后再试。");
    }
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

/**
 * Enqueue a command. Runs immediately if idle, otherwise queues (FIFO).
 * Caller may pass `taskId` to pre-allocate the id (e.g. to emit task.event
 * with the same id before enqueue); otherwise a fresh ulid is generated.
 */
function enqueueCmd(item: Omit<QueueItem, "taskId"> & { taskId?: string }): string {
  const taskId = item.taskId ?? ulid();
  const full: QueueItem = {
    from: item.from,
    cmdId: item.cmdId,
    text: item.text,
    workdir: item.workdir,
    opts: item.opts,
    taskId,
  };
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
  const wd = workdir ?? currentWorkdir();
  const verdict = classifyCommand(text, wd);
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

  // Dispatch by workspace config: tmux-inject | spawn-codex | spawn-claude.
  const wsName = state.activeWorkspace ?? "";
  const wsConfig = getWorkspaceConfig(wsName);
  const resumeFrom = wsConfig.sessionId ?? lastSessionByWorkdir.get(wd);
  if (resumeFrom && wsConfig.mode === "spawn") {
    log(`session: resuming ${taskId} from prior session ${resumeFrom.slice(0, 8)}… in ${wd}`);
  }

  type AnyTask = { kill: () => void; done: Promise<{ ok: boolean; result: string }> };
  let task: AnyTask;

  if (wsConfig.mode === "tmux" && wsConfig.tmuxTarget) {
    log(`dispatch: tmux-inject → ${wsConfig.tmuxTarget} (engine=${wsConfig.engine})`);
    task = runTmuxInject({
      target: wsConfig.tmuxTarget,
      prompt: text,
      onEvent: (e) => emit(e.ev, e.data),
    });
  } else if (wsConfig.engine === "codex") {
    log(`dispatch: spawn codex in ${wd}`);
    task = runCodex({
      prompt: text,
      workdir: wd,
      resumeSessionId: resumeFrom,
      onSessionId: (sid) => {
        store.setAgentSession(taskId, sid);
        lastSessionByWorkdir.set(wd, sid);
        setWorkspaceSessionId(wsName, sid);
      },
      onEvent: (e) => emit(e.ev, e.data),
    });
  } else {
    log(`dispatch: spawn claude in ${wd}`);
    task = runClaudeCode({
      prompt: text,
      workdir: wd,
      resumeSessionId: resumeFrom,
      onSessionId: (sid) => {
        store.setAgentSession(taskId, sid);
        lastSessionByWorkdir.set(wd, sid);
        setWorkspaceSessionId(wsName, sid);
      },
      onEvent: (e) => emit(e.ev, e.data),
    });
  }

  active = { taskId, from, kill: task.kill };
  const { ok, result } = await task.done;
  active = null;
  store.setStatus(taskId, ok ? "done" : "error");
  if (opts?.voiceReply) {
    const spoken = ok ? result || "完成了。" : `出错了：${result.slice(0, 200)}`;
    remember(from, "assistant", `[任务结果] ${spoken.slice(0, 300)}`);
    void speakTo(from, spoken, { expectReply: true });
  }
}

// ---- payload routing --------------------------------------------------------

/** Probe which agent CLIs are installed + logged in. Cheap, sync, cacheable. */
function detectEngines(): EngineInfo[] {
  const claudePath = [
    process.env.JARVIS_CLAUDE_BIN,
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    `${process.env.HOME}/.claude/local/claude`,
  ].find((p): p is string => !!p && existsSync(p));
  const codexPath = findCodexBin();

  // Logged-in heuristics:
  //   claude: ~/.claude/.credentials.json OR env ANTHROPIC_API_KEY/AUTH_TOKEN set
  //   codex:  ~/.codex/auth.json exists and non-empty
  const claudeCreds =
    existsSync(join(homedir(), ".claude", ".credentials.json")) ||
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.ANTHROPIC_AUTH_TOKEN ||
    !!process.env.ZHIPU_API_KEY;
  const codexAuthFile = join(homedir(), ".codex", "auth.json");
  const codexLoggedIn = existsSync(codexAuthFile);

  return [
    {
      engine: "claude",
      installed: !!claudePath,
      ...(claudePath ? { path: claudePath } : {}),
      loggedIn: claudeCreds,
    },
    {
      engine: "codex",
      installed: !!codexPath,
      ...(codexPath ? { path: codexPath } : {}),
      loggedIn: codexLoggedIn,
    },
  ];
}

/** Push the full workspace-config map to a single device. */
function pushWorkspaceConfigs(to: string): void {
  sendTo(to, {
    t: "workspace.config.state",
    seq: 0,
    configs: getAllWorkspaceConfigs(),
  });
}

function handlePayload(from: string, payload: Payload): void {
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
      // Push current workspace configs + engine availability so the phone UI
      // can populate the mode/engine pickers immediately after pairing.
      pushWorkspaceConfigs(from);
      sendTo(from, { t: "engine.state", seq: 0, engines: detectEngines() });
      // Push the current agent list so the phone can render the "会话"
      // picker immediately — without this the user sees an empty list
      // until they manually open the sheet, which would defeat resume.
      sendTo(from, {
        t: "agent.state",
        seq: 0,
        agents: agentManager_listForPush(),
      });
      break;
    }
    case "ack":
      ch.outbox.ackUpTo(payload.upTo);
      break;
    case "cmd.submit":
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
    case "workspace.list":
      sendTo(from, {
        t: "workspace.state",
        seq: 0,
        active: state.activeWorkspace ?? "",
        workspaces: listWorkspaces(),
      });
      break;
    case "workspace.switch":
      switchWorkspace(payload.name);
      sendTo(from, {
        t: "workspace.state",
        seq: 0,
        active: state.activeWorkspace ?? "",
        workspaces: listWorkspaces(),
      });
      // Also refresh config + engine state so the phone renders the right
      // mode/engine badge for the newly-active workspace.
      pushWorkspaceConfigs(from);
      sendTo(from, { t: "engine.state", seq: 0, engines: detectEngines() });
      break;
    case "memory.list":
      sendTo(from, {
        t: "memory.state",
        seq: 0,
        items: listMemory(),
      });
      break;
    case "memory.update": {
      updateMemory(payload.key, payload.value, payload.category);
      // broadcast updated state to all devices (memory is global)
      broadcast(() => ({
        t: "memory.state",
        seq: 0,
        items: listMemory(),
      }));
      break;
    }
    case "memory.delete": {
      deleteMemory(payload.key);
      broadcast(() => ({
        t: "memory.state",
        seq: 0,
        items: listMemory(),
      }));
      break;
    }
    case "settings.get":
      sendTo(from, {
        t: "settings.state",
        seq: 0,
        settings: getAllSettings(),
      });
      break;
    case "settings.set": {
      const r = setSetting(payload.key, payload.value);
      if (!r.ok) {
        log(`settings.set rejected: ${r.reason}`);
      }
      // broadcast new state regardless (so phone sees canonical values)
      broadcast(() => ({
        t: "settings.state",
        seq: 0,
        settings: getAllSettings(),
      }));
      break;
    }
    case "history.list": {
      const limit = payload.limit ?? 100;
      const entries = store.listEvents(limit);
      sendTo(from, {
        t: "history.state",
        seq: 0,
        entries,
      });
      break;
    }
    case "workspace.config.update": {
      const updated = setWorkspaceConfig(payload.workspace, payload.config);
      log(`workspace.config.update: ${payload.workspace} → ${updated.mode}/${updated.engine}` +
        (updated.tmuxTarget ? ` target=${updated.tmuxTarget}` : ""));
      // broadcast to all devices so every phone sees the same config
      broadcast(() => ({
        t: "workspace.config.state",
        seq: 0,
        configs: getAllWorkspaceConfigs(),
      }));
      break;
    }
    case "tmux.pane.list": {
      void (async () => {
        const available = await tmuxAvailable();
        if (!available) {
          sendTo(from, { t: "tmux.pane.state", seq: 0, panes: [] });
          return;
        }
        const panes = await detectTmuxPanes();
        log(`tmux.pane.list: ${panes.length} panes (claude/codex/unknown)`);
        sendTo(from, { t: "tmux.pane.state", seq: 0, panes });
      })();
      break;
    }
    case "engine.list": {
      sendTo(from, { t: "engine.state", seq: 0, engines: detectEngines() });
      break;
    }
    // ---- agents (Phase G) ----
    case "agent.list": {
      sendTo(from, { t: "agent.state", seq: 0, agents: agentManager_listForPush() });
      break;
    }
    case "agent.create": {
      const wsName = payload.workspace;
      const cwd = resolveWsCwd(wsName);
      const title = payload.first_prompt.trim().slice(0, 60) || "新会话";
      const agent = agentsCreate({
        workspace: wsName,
        engine: payload.engine,
        cwd,
        title,
      });
      log(`agent.create: ${agent.id} ws=${wsName} engine=${payload.engine} title="${title}"`);
      // Spawn the first message immediately.
      const r = agentManager_spawn(agent.id, payload.first_prompt, from);
      if (!r.ok) log(`agent.create spawn failed: ${r.reason}`);
      // Push fresh agent list to all devices.
      broadcast(() => ({ t: "agent.state", seq: 0, agents: agentManager_listForPush() }));
      break;
    }
    case "agent.message": {
      const r = agentManager_spawn(payload.agent_id, payload.text, from);
      if (!r.ok) {
        log(`agent.message ${payload.agent_id} rejected: ${r.reason}`);
      }
      break;
    }
    case "agent.stop": {
      agentManager_stop(payload.agent_id);
      broadcast(() => ({ t: "agent.state", seq: 0, agents: agentManager_listForPush() }));
      break;
    }
    case "agent.delete": {
      agentManager_stop(payload.agent_id);
      agentsDelete(payload.agent_id);
      broadcast(() => ({ t: "agent.state", seq: 0, agents: agentManager_listForPush() }));
      break;
    }
    case "agent.history": {
      const agent = agentsGet(payload.agent_id);
      if (!agent?.session_id) {
        sendTo(from, {
          t: "agent.history.state",
          seq: 0,
          agent_id: payload.agent_id,
          entries: [],
        });
        break;
      }
      const entries =
        agent.engine === "codex"
          ? [] // codex history reading not implemented yet
          : readClaudeHistory(agent.session_id, payload.limit ?? 100);
      sendTo(from, {
        t: "agent.history.state",
        seq: 0,
        agent_id: payload.agent_id,
        entries,
      });
      break;
    }
    case "task.card.action":
      // For now, route task card button taps as plain text commands so the
      // brain re-interprets them. Later we can have structured dispatch.
      log(`task.card.action: taskId=${payload.taskId} action=${payload.actionId}`);
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

// Reconcile agent state after daemon restart:
//   - reattach capture-pane pollers to agents whose tmux sessions survived
//   - flip agents whose tmux is gone (Mac rebooted) to idle
//   - backfill missing session_ids for older agents
// Done synchronously after relay is up so the first paired device to hello
// already sees a consistent agent.state.
try {
  reconcileAgents({
    taskStore: store,
    resolveCwd: resolveWsCwd,
    broadcast: (make) => broadcast(() => make() as Payload & { seq: number }),
    sendTo: (to, make) => sendTo(to, make() as Payload & { seq: number }),
    log,
  });
} catch (e) {
  log(`reconcileAgents failed (non-fatal): ${e}`);
}

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
        activeWorkspace: state.activeWorkspace ?? "",
        workspaces: listWorkspaces(),
      }),
    );
    return;
  }
  if (req.method === "GET" && req.url === "/workspaces") {
    res.end(
      JSON.stringify({
        active: state.activeWorkspace ?? "",
        workspaces: listWorkspaces(),
        root: state.workdir,
      }),
    );
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/workspaces/switch")) {
    const url = new URL(req.url, "http://localhost");
    const name = url.searchParams.get("name") ?? "";
    const active = switchWorkspace(name);
    broadcastWorkspaceState();
    res.end(
      JSON.stringify({
        ok: true,
        active,
        workspaces: listWorkspaces(),
      }),
    );
    return;
  }
  // ---- agents HTTP API (for desktop app — not a paired relay device) ----
  if (req.method === "GET" && req.url === "/agents/list") {
    res.end(JSON.stringify(agentManager_listForPush()));
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/agents/create")) {
    // Read body (workspace + engine + first_prompt).
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => {
      try {
        const { workspace, engine, first_prompt } = JSON.parse(body) as {
          workspace: string;
          engine: "claude" | "codex";
          first_prompt: string;
        };
        const cwd = resolveWsCwd(workspace);
        const title = first_prompt.trim().slice(0, 60) || "新会话";
        const agent = agentsCreate({ workspace, engine, cwd, title });
        const r = agentManager_spawn(agent.id, first_prompt, "desktop-admin");
        log(`admin /agents/create: ${agent.id} ok=${r.ok} reason=${r.reason ?? ""}`);
        res.end(JSON.stringify({ ok: r.ok, agent_id: agent.id, reason: r.reason }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/agents/message")) {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => {
      try {
        const { agent_id, text } = JSON.parse(body) as { agent_id: string; text: string };
        const r = agentManager_spawn(agent_id, text, "desktop-admin");
        res.end(JSON.stringify({ ok: r.ok, reason: r.reason }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/agents/stop")) {
    const url = new URL(req.url, "http://localhost");
    const id = url.searchParams.get("id") ?? "";
    const ok = agentManager_stop(id);
    res.end(JSON.stringify({ ok }));
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/agents/send-key")) {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => {
      try {
        const { agent_id, key } = JSON.parse(body) as { agent_id: string; key: string };
        const ok = agentManager_sendKey(agent_id, key);
        res.end(JSON.stringify({ ok }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/agents/delete")) {
    const url = new URL(req.url, "http://localhost");
    const id = url.searchParams.get("id") ?? "";
    agentManager_stop(id);
    const ok = agentsDelete(id);
    res.end(JSON.stringify({ ok }));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
admin.listen(ADMIN_PORT, "127.0.0.1", () => {
  log(`admin on 127.0.0.1:${ADMIN_PORT}, relay ${RELAY_URL}, workdir ${state.workdir}`);
  log(`paired devices: ${state.devices.length}`);
});
