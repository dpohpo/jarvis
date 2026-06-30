/**
 * Inner payloads — what devices say to each other AFTER decryption.
 * The relay never sees any of this.
 */
import { z } from "zod";

export const HelloPayload = z.object({
  t: z.literal("hello"),
  seq: z.number().int().nonnegative(),
  resumeFrom: z.number().int().nonnegative().optional(),
  deviceName: z.string().optional(),
});

/** Phone → daemon: a natural-language command. */
export const CmdSubmit = z.object({
  t: z.literal("cmd.submit"),
  seq: z.number().int(),
  cmdId: z.string(),
  text: z.string().min(1),
  workdir: z.string().optional(),
  resumeTaskId: z.string().optional(),
});

export const TaskEventKind = z.enum([
  "started",
  "thinking",
  "output",
  "tool_use",
  "progress",
  "done",
  "error",
]);

/** Daemon → phone: streamed task lifecycle. `output` chunks are batched (~100ms / 2KB). */
export const TaskEvent = z.object({
  t: z.literal("task.event"),
  seq: z.number().int(),
  taskId: z.string(),
  cmdId: z.string().optional(),
  ev: TaskEventKind,
  data: z.string(),
  ts: z.number().int(),
});

export const PermRequest = z.object({
  t: z.literal("perm.request"),
  seq: z.number().int(),
  reqId: z.string(),
  taskId: z.string(),
  tier: z.union([z.literal(2), z.literal(3)]),
  summary: z.string(),
  detail: z.string(),
  timeoutSec: z.number().int().positive(),
  onTimeout: z.literal("deny"),
});

export const PermResponse = z.object({
  t: z.literal("perm.response"),
  seq: z.number().int(),
  reqId: z.string(),
  decision: z.enum(["allow", "deny"]),
  scope: z.enum(["once", "session", "always"]).default("once"),
});

export const TaskListReq = z.object({
  t: z.literal("task.list"),
  seq: z.number().int(),
});

// ---- workspace family ------------------------------------------------------
// Workspaces are subdirectories of the daemon's workdir (~/JarvisRemoteControl
// by default). The phone can list them, switch the active one, and query the
// current state. All subsequent cmd.submit executions land in the active
// workspace unless the command itself carries an explicit workdir.

/** Phone → daemon: list available workspaces (subdirs of workdir). */
export const WorkspaceListReq = z.object({
  t: z.literal("workspace.list"),
  seq: z.number().int(),
});

/** Phone → daemon: switch the active workspace. `name` "" means the workdir root. */
export const WorkspaceSwitch = z.object({
  t: z.literal("workspace.switch"),
  seq: z.number().int(),
  name: z.string(),
});

/** Daemon → phone: current workspace + the full list. */
export const WorkspaceState = z.object({
  t: z.literal("workspace.state"),
  seq: z.number().int(),
  active: z.string(),
  workspaces: z.array(z.string()),
});

/** Phone → daemon: stop a running/queued task. Omit taskId to stop everything. */
export const TaskStop = z.object({
  t: z.literal("task.stop"),
  seq: z.number().int(),
  taskId: z.string().optional(),
});

export const TaskSummary = z.object({
  taskId: z.string(),
  status: z.enum(["running", "waiting_approval", "paused", "done", "error"]),
  title: z.string(),
  workdir: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const TaskState = z.object({
  t: z.literal("task.state"),
  seq: z.number().int(),
  tasks: z.array(TaskSummary),
});

export const Ack = z.object({
  t: z.literal("ack"),
  upTo: z.number().int(),
});

// ---- voice family ----------------------------------------------------------
// Voice payloads travel in kind:"voice" envelopes: fire-and-forget, never
// queued for offline devices, and BYPASS the Outbox/Inbox reliable channel.
// Their `seq` is a per-stream position counter, not a channel sequence.

export const VoiceStart = z.object({
  t: z.literal("voice.start"),
  seq: z.number().int(),
  fmt: z.literal("pcm16k"), // 16kHz mono signed 16-bit LE
});

export const VoiceChunk = z.object({
  t: z.literal("voice.chunk"),
  seq: z.number().int(),
  data: z.string(), // base64 PCM
});

export const VoiceEnd = z.object({
  t: z.literal("voice.end"),
  seq: z.number().int(),
});

/** Daemon → phone: what we heard (reliable msg, shows in transcript). */
export const AsrFinal = z.object({
  t: z.literal("asr.final"),
  seq: z.number().int(),
  text: z.string(),
});

export const TtsStart = z.object({
  t: z.literal("tts.start"),
  seq: z.number().int(),
  mime: z.string(), // e.g. "audio/wav"
  /** Playback length computed from the WAV header — phones schedule auto-listen off this. */
  durationMs: z.number().int().optional(),
  /** True when the daemon expects a spoken follow-up (clarify / conversation). */
  expectReply: z.boolean().optional(),
});

export const TtsChunk = z.object({
  t: z.literal("tts.chunk"),
  seq: z.number().int(),
  data: z.string(), // base64 audio
});

export const TtsEnd = z.object({
  t: z.literal("tts.end"),
  seq: z.number().int(),
});

/** Pairing: sent as a sealed box to the daemon, NOT as a regular peer message. */
export const PairRequest = z.object({
  t: z.literal("pair.request"),
  token: z.string(),
  deviceName: z.string(),
  boxPub: z.string(), // base64
  signPub: z.string(), // base64
});

export const PairAccept = z.object({
  t: z.literal("pair.accept"),
  daemonName: z.string(),
  deviceId: z.string(),
});

// ---- Phase B: structured task cards (Paseo action cards) -------------------
// Daemon → phone: a structured view of a task that's better rendered as a card
// than as a flat log line. Replaces ad-hoc `📋 ${task}` text in many cases.
export const TaskCard = z.object({
  t: z.literal("task.card"),
  seq: z.number().int(),
  taskId: z.string(),
  title: z.string(),
  subtitle: z.string().default(""),
  /** Lifecycle stage shown on the card header. */
  status: z.enum(["draft", "pending", "running", "done", "error"]).default("running"),
  /** Optional quick actions the phone can render as buttons. */
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    style: z.enum(["default", "primary", "danger"]).default("default"),
  })).default([]),
});

/** Phone → daemon: user tapped a quick-action button on a task card. */
export const TaskCardAction = z.object({
  t: z.literal("task.card.action"),
  seq: z.number().int(),
  taskId: z.string(),
  actionId: z.string(),
});

// ---- Phase C: memory (visible, editable user facts) ------------------------
export const MemoryItem = z.object({
  key: z.string(),
  value: z.string(),
  category: z.string().default("general"),
  updatedAt: z.number().int(),
});

export const MemoryListReq = z.object({
  t: z.literal("memory.list"),
  seq: z.number().int(),
});

export const MemoryState = z.object({
  t: z.literal("memory.state"),
  seq: z.number().int(),
  items: z.array(MemoryItem),
});

export const MemoryUpdate = z.object({
  t: z.literal("memory.update"),
  seq: z.number().int(),
  key: z.string(),
  value: z.string(),
  category: z.string().default("general"),
});

export const MemoryDelete = z.object({
  t: z.literal("memory.delete"),
  seq: z.number().int(),
  key: z.string(),
});

// ---- Phase D: settings -----------------------------------------------------
// Settings is an opaque record<string, unknown> — the daemon knows the schema
// per key (e.g. voiceReply: boolean, defaultRemindMin: number) and validates.
export const SettingsGetReq = z.object({
  t: z.literal("settings.get"),
  seq: z.number().int(),
});

export const SettingsState = z.object({
  t: z.literal("settings.state"),
  seq: z.number().int(),
  settings: z.record(z.string(), z.unknown()),
});

export const SettingsSet = z.object({
  t: z.literal("settings.set"),
  seq: z.number().int(),
  key: z.string(),
  value: z.unknown(),
});

// ---- Phase E: history (reuses TaskStore events table) ----------------------
export const HistoryListReq = z.object({
  t: z.literal("history.list"),
  seq: z.number().int(),
  limit: z.number().int().optional(),
});

export const HistoryEntry = z.object({
  taskId: z.string(),
  ev: z.string(),
  data: z.string(),
  ts: z.number().int(),
});

export const HistoryState = z.object({
  t: z.literal("history.state"),
  seq: z.number().int(),
  entries: z.array(HistoryEntry),
});

// ---- Phase F: workspace config (mode/engine/tmuxTarget per workspace) -------
// Each workspace can be configured independently:
//   mode:   "spawn" = daemon spawns `claude -p` / `codex exec` child process
//           "tmux"  = daemon injects via `tmux send-keys` into a live pane
//   engine: "claude" or "codex"
//   tmuxTarget: "session:window.pane" (mode==="tmux" only), e.g. "glm-…:1.1"
//   sessionId:  spawn-mode sticky session id (managed by daemon, read-only on phone)
export const WorkspaceMode = z.enum(["spawn", "tmux"]);
export const WorkspaceEngine = z.enum(["claude", "codex"]);

export const WorkspaceConfig = z.object({
  mode: WorkspaceMode.default("spawn"),
  engine: WorkspaceEngine.default("claude"),
  tmuxTarget: z.string().optional(),
  sessionId: z.string().optional(),
  /** Provider override (claude, codex, copilot, gemini). Defaults to engine. */
  defaultProvider: z.string().optional(),
  /** Model override (e.g. "claude-opus-4-6", "gpt-5"). */
  defaultModel: z.string().optional(),
});

export const WorkspaceConfigUpdate = z.object({
  t: z.literal("workspace.config.update"),
  seq: z.number().int(),
  workspace: z.string(),
  config: WorkspaceConfig,
});

export const WorkspaceConfigState = z.object({
  t: z.literal("workspace.config.state"),
  seq: z.number().int(),
  configs: z.record(z.string(), WorkspaceConfig),
});

// ---- Phase F: tmux pane discovery ------------------------------------------
// Phone asks for panes that look like claude/codex/free-code; daemon scans
// `tmux list-panes -a` and walks each pane's process tree.
export const TmuxPaneInfo = z.object({
  target: z.string(),             // "session:window.pane"
  engine: z.enum(["claude", "codex", "unknown"]),
  cwd: z.string(),
  cmd: z.string(),                // pane_current_command
  pid: z.number(),
});

export const TmuxPaneListReq = z.object({
  t: z.literal("tmux.pane.list"),
  seq: z.number().int(),
});

export const TmuxPaneState = z.object({
  t: z.literal("tmux.pane.state"),
  seq: z.number().int(),
  panes: z.array(TmuxPaneInfo),
});

// ---- Phase F: engine availability ------------------------------------------
// daemon reports which CLIs are installed + logged in
export const EngineInfo = z.object({
  engine: z.enum(["claude", "codex"]),
  installed: z.boolean(),
  path: z.string().optional(),
  version: z.string().optional(),
  loggedIn: z.boolean(),
});

export const EngineListReq = z.object({
  t: z.literal("engine.list"),
  seq: z.number().int(),
});

export const EngineState = z.object({
  t: z.literal("engine.state"),
  seq: z.number().int(),
  engines: z.array(EngineInfo),
});

// ---- Phase F2: provider abstraction (multi-provider support) -------------
// Providers extend the engine concept to support Claude Code / Codex / Copilot / Gemini.
// Phone can query available providers and their models, then select one when creating agents.
export const ProviderListReq = z.object({
  t: z.literal("provider.list"),
  seq: z.number().int(),
});

export const ProviderInfo = z.object({
  id: z.string(),
  name: z.string(),
  available: z.boolean(),
  models: z.array(z.string()),
});

export const ProviderListState = z.object({
  t: z.literal("provider.state"),
  seq: z.number().int(),
  providers: z.array(ProviderInfo),
});

// ---- Phase F3: multi-host (simplified) ------------------------------------
// Phone can register multiple Mac hosts and switch between them.
// This is a simplified version without full mesh sync.
export const HostInfo = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  status: z.enum(["online", "offline"]),
  lastSeen: z.number().int(),
});

export const HostRegister = z.object({
  t: z.literal("host.register"),
  seq: z.number().int(),
  host: HostInfo,
});

export const HostListReq = z.object({
  t: z.literal("host.list"),
  seq: z.number().int(),
});

export const HostListState = z.object({
  t: z.literal("host.state"),
  seq: z.number().int(),
  hosts: z.array(HostInfo),
});

export const HostDisconnect = z.object({
  t: z.literal("host.disconnect"),
  seq: z.number().int(),
  hostId: z.string(),
});

// ---- Phase G: agents (multi-session, resume-able) -------------------------
// An Agent is a persistent work unit. Each agent has its own session-id
// (Claude Code's --resume target or Codex's rollout thread id) and can be
// paused / resumed / forked. Multiple agents can run concurrently.
export const AgentInfo = z.object({
  id: z.string(),
  workspace: z.string(),
  engine: z.enum(["claude", "codex"]),
  session_id: z.string().optional(),
  title: z.string(),
  created_at: z.number().int(),
  last_active: z.number().int(),
  status: z.enum(["idle", "running", "done", "error"]),
  cwd: z.string(),
  message_count: z.number().int().default(0),
});

export const AgentCreate = z.object({
  t: z.literal("agent.create"),
  seq: z.number().int(),
  workspace: z.string(),
  engine: z.enum(["claude", "codex"]),
  first_prompt: z.string(),
  /** Optional client-generated id (e.g. `agent-${ulid()}`). When set, the
   *  daemon uses it as the primary key instead of generating its own. Lets
   *  the phone setSelectedAgentId(id) immediately without waiting for the
   *  agent.state push round-trip. Same pattern as CmdSubmit.cmdId. */
  agent_id: z.string().optional(),
  /** Optional title (defaults to first_prompt.slice(0, 60) in daemon). */
  title: z.string().optional(),
});

export const AgentListReq = z.object({
  t: z.literal("agent.list"),
  seq: z.number().int(),
});

export const AgentState = z.object({
  t: z.literal("agent.state"),
  seq: z.number().int(),
  agents: z.array(AgentInfo),
});

/** Send a follow-up message to an existing agent (resume). */
export const AgentMessage = z.object({
  t: z.literal("agent.message"),
  seq: z.number().int(),
  agent_id: z.string(),
  text: z.string(),
});

/** Stop a running agent (kill the spawn). */
export const AgentStop = z.object({
  t: z.literal("agent.stop"),
  seq: z.number().int(),
  agent_id: z.string(),
});

/** Request historical messages for an agent (for resume / replay). */
export const AgentHistoryReq = z.object({
  t: z.literal("agent.history"),
  seq: z.number().int(),
  agent_id: z.string(),
  limit: z.number().int().optional(),
});

export const AgentHistoryEntry = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  ts: z.number().int(),
});

export const AgentHistoryState = z.object({
  t: z.literal("agent.history.state"),
  seq: z.number().int(),
  agent_id: z.string(),
  entries: z.array(AgentHistoryEntry),
});

/** Delete an agent record (keeps the underlying session jsonl/rollout file). */
export const AgentDelete = z.object({
  t: z.literal("agent.delete"),
  seq: z.number().int(),
  agent_id: z.string(),
});

/** Rename an existing agent (updates title only). Daemon broadcasts a fresh
 *  agent.state to all paired devices after the update. */
export const AgentRename = z.object({
  t: z.literal("agent.rename"),
  seq: z.number().int(),
  agent_id: z.string(),
  title: z.string(),
});

export const Payload = z.discriminatedUnion("t", [
  HelloPayload,
  CmdSubmit,
  TaskEvent,
  PermRequest,
  PermResponse,
  TaskListReq,
  TaskStop,
  TaskState,
  Ack,
  PairAccept,
  VoiceStart,
  VoiceChunk,
  VoiceEnd,
  AsrFinal,
  TtsStart,
  TtsChunk,
  TtsEnd,
  WorkspaceListReq,
  WorkspaceSwitch,
  WorkspaceState,
  TaskCard,
  TaskCardAction,
  MemoryListReq,
  MemoryState,
  MemoryUpdate,
  MemoryDelete,
  SettingsGetReq,
  SettingsState,
  SettingsSet,
  HistoryListReq,
  HistoryState,
  WorkspaceConfigUpdate,
  WorkspaceConfigState,
  TmuxPaneListReq,
  TmuxPaneState,
  EngineListReq,
  EngineState,
  ProviderListReq,
  ProviderListState,
  HostRegister,
  HostListReq,
  HostListState,
  HostDisconnect,
  AgentCreate,
  AgentListReq,
  AgentState,
  AgentMessage,
  AgentStop,
  AgentHistoryReq,
  AgentHistoryState,
  AgentDelete,
  AgentRename,
]);

/** Payload types that bypass the reliable channel (own stream seq, kind:"voice"). */
export const VOICE_FAMILY = new Set([
  "voice.start",
  "voice.chunk",
  "voice.end",
  "tts.start",
  "tts.chunk",
  "tts.end",
]);

export type Payload = z.infer<typeof Payload>;
export type CmdSubmit = z.infer<typeof CmdSubmit>;
export type TaskEvent = z.infer<typeof TaskEvent>;
export type TaskEventKind = z.infer<typeof TaskEventKind>;
export type PermRequest = z.infer<typeof PermRequest>;
export type PermResponse = z.infer<typeof PermResponse>;
export type TaskSummary = z.infer<typeof TaskSummary>;
export type PairRequest = z.infer<typeof PairRequest>;
export type PairAccept = z.infer<typeof PairAccept>;
export type HelloPayload = z.infer<typeof HelloPayload>;
export type TaskStop = z.infer<typeof TaskStop>;
export type VoiceStart = z.infer<typeof VoiceStart>;
export type VoiceChunk = z.infer<typeof VoiceChunk>;
export type VoiceEnd = z.infer<typeof VoiceEnd>;
export type AsrFinal = z.infer<typeof AsrFinal>;
export type TtsStart = z.infer<typeof TtsStart>;
export type TtsChunk = z.infer<typeof TtsChunk>;
export type TtsEnd = z.infer<typeof TtsEnd>;
export type WorkspaceListReq = z.infer<typeof WorkspaceListReq>;
export type WorkspaceSwitch = z.infer<typeof WorkspaceSwitch>;
export type WorkspaceState = z.infer<typeof WorkspaceState>;
export type WorkspaceMode = z.infer<typeof WorkspaceMode>;
export type WorkspaceEngine = z.infer<typeof WorkspaceEngine>;
export type WorkspaceConfig = z.infer<typeof WorkspaceConfig>;
export type WorkspaceConfigUpdate = z.infer<typeof WorkspaceConfigUpdate>;
export type WorkspaceConfigState = z.infer<typeof WorkspaceConfigState>;
export type TmuxPaneInfo = z.infer<typeof TmuxPaneInfo>;
export type TmuxPaneListReq = z.infer<typeof TmuxPaneListReq>;
export type TmuxPaneState = z.infer<typeof TmuxPaneState>;
export type EngineInfo = z.infer<typeof EngineInfo>;
export type EngineListReq = z.infer<typeof EngineListReq>;
export type EngineState = z.infer<typeof EngineState>;
export type ProviderListReq = z.infer<typeof ProviderListReq>;
export type ProviderInfo = z.infer<typeof ProviderInfo>;
export type ProviderListState = z.infer<typeof ProviderListState>;
export type HostInfo = z.infer<typeof HostInfo>;
export type HostRegister = z.infer<typeof HostRegister>;
export type HostListReq = z.infer<typeof HostListReq>;
export type HostListState = z.infer<typeof HostListState>;
export type HostDisconnect = z.infer<typeof HostDisconnect>;
export type AgentInfo = z.infer<typeof AgentInfo>;
export type AgentCreate = z.infer<typeof AgentCreate>;
export type AgentListReq = z.infer<typeof AgentListReq>;
export type AgentState = z.infer<typeof AgentState>;
export type AgentMessage = z.infer<typeof AgentMessage>;
export type AgentStop = z.infer<typeof AgentStop>;
export type AgentHistoryReq = z.infer<typeof AgentHistoryReq>;
export type AgentHistoryEntry = z.infer<typeof AgentHistoryEntry>;
export type AgentHistoryState = z.infer<typeof AgentHistoryState>;
export type AgentDelete = z.infer<typeof AgentDelete>;
export type AgentRename = z.infer<typeof AgentRename>;
