/**
 * JarvisClient — the phone side of the encrypted channel.
 * Same protocol path as packages/phone-sim, wrapped for React state consumption.
 */
import {
  Inbox,
  Outbox,
  type Payload,
  type PermRequest,
  RelayClient,
  type TaskEvent,
  type TaskSummary,
  type WorkspaceConfig,
  type TmuxPaneInfo,
  type EngineInfo,
  type AgentInfo,
  type AgentHistoryEntry,
  fromB64,
  generateIdentity,
  openPayload,
  pairEnvelope,
  randomId,
  seal,
  sealPayload,
  toB64,
  utf8ToBytes,
} from "@jarvis/protocol";
import { type PhoneState, saveState } from "./store";

export interface PairInfo {
  relayUrl: string;
  room: string;
  daemonDeviceId: string;
  daemonBoxPub: string;
  token: string;
}

export interface JarvisCallbacks {
  onTaskEvent: (e: TaskEvent) => void;
  onPermRequest: (r: PermRequest) => void;
  onTaskState: (tasks: TaskSummary[]) => void;
  onLink: (up: boolean) => void;
  /** What the daemon heard us say (final transcription). */
  onAsrFinal?: (text: string) => void;
  /** Complete TTS reply assembled — base64 chunks of one audio file. */
  onTtsReady?: (
    chunksB64: string[],
    mime: string,
    durationMs: number,
    expectReply: boolean,
  ) => void;
  /** Workspace list / active workspace changed (workspace.state from daemon). */
  onWorkspaceState?: (active: string, workspaces: string[]) => void;
  /** Memory list updated (memory.state from daemon). */
  onMemoryState?: (items: Array<{ key: string; value: string; category: string; updatedAt: number }>) => void;
  /** Settings changed (settings.state from daemon). */
  onSettingsState?: (settings: Record<string, unknown>) => void;
  /** History timeline (history.state from daemon). */
  onHistoryState?: (entries: Array<{ taskId: string; ev: string; data: string; ts: number }>) => void;
  /** Workspace configs map (workspace.config.state from daemon). */
  onWorkspaceConfigs?: (configs: Record<string, WorkspaceConfig>) => void;
  /** Discovered tmux panes (tmux.pane.state from daemon). */
  onTmuxPanes?: (panes: TmuxPaneInfo[]) => void;
  /** Engine availability (engine.state from daemon). */
  onEngines?: (engines: EngineInfo[]) => void;
  /** Agent list snapshot (agent.state from daemon). */
  onAgentState?: (agents: AgentInfo[]) => void;
  /** Agent history replay (agent.history.state from daemon). */
  onAgentHistory?: (agentId: string, entries: AgentHistoryEntry[]) => void;
}

/** Scan result → paired PhoneState. Resolves once the daemon accepts. */
export function pairWithDaemon(info: PairInfo, deviceName: string): Promise<PhoneState> {
  const id = generateIdentity();
  const state: PhoneState = {
    deviceId: `phone-${randomId().slice(0, 8)}`,
    boxPub: toB64(id.box.publicKey),
    boxPriv: toB64(id.box.privateKey),
    signPub: toB64(id.sign.publicKey),
    signPriv: toB64(id.sign.privateKey),
    relayUrl: info.relayUrl,
    room: info.room,
    daemonDeviceId: info.daemonDeviceId,
    daemonBoxPub: info.daemonBoxPub,
    lastSeq: 0,
    sentSeq: 0,
  };

  const sealed = seal(
    utf8ToBytes(
      JSON.stringify({
        t: "pair.request",
        token: info.token,
        deviceName,
        boxPub: state.boxPub,
        signPub: state.signPub,
      }),
    ),
    fromB64(info.daemonBoxPub),
  );

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.stop();
      reject(new Error("配对超时 — 确认 daemon 在线且二维码未过期"));
    }, 15_000);

    const client = new RelayClient({
      url: state.relayUrl,
      deviceId: state.deviceId,
      room: state.room,
      signPublicB64: state.signPub,
      signPrivate: fromB64(state.signPriv),
      makeWebSocket: (url) => new WebSocket(url) as never,
      onUp: () => {
        client.send(pairEnvelope(state.room, state.deviceId, state.daemonDeviceId, sealed));
      },
      onEnvelope: (env) => {
        const payload = openPayload(env, {
          theirBoxPublic: fromB64(state.daemonBoxPub),
          myBoxPrivate: fromB64(state.boxPriv),
        });
        if (payload?.t === "pair.accept") {
          clearTimeout(timer);
          client.stop();
          resolve(state);
        }
      },
    });
    client.start();
  });
}

export class JarvisClient {
  private relay: RelayClient;
  private outbox: Outbox<Payload>;
  private inbox = new Inbox();
  private voiceSeq = 0;
  private ttsChunks: string[] = [];
  private ttsMime = "audio/wav";
  private ttsDurationMs = 0;
  private ttsExpectReply = false;

  constructor(
    private state: PhoneState,
    private cb: JarvisCallbacks,
  ) {
    this.outbox = new Outbox<Payload>(state.sentSeq);
    this.relay = new RelayClient({
      url: state.relayUrl,
      deviceId: state.deviceId,
      room: state.room,
      signPublicB64: state.signPub,
      signPrivate: fromB64(state.signPriv),
      makeWebSocket: (url) => new WebSocket(url) as never,
      onUp: () => {
        cb.onLink(true);
        // resume: ask the daemon to replay anything we missed
        this.send({ t: "hello", seq: 0, resumeFrom: this.state.lastSeq } as never);
      },
      onDown: () => cb.onLink(false),
      onEnvelope: (env) => {
        const payload = openPayload(env, {
          theirBoxPublic: fromB64(this.state.daemonBoxPub),
          myBoxPrivate: fromB64(this.state.boxPriv),
        });
        if (payload) this.handle(payload);
      },
    });
  }

  start(): void {
    this.relay.start();
  }

  stop(): void {
    this.relay.stop();
  }

  submitCommand(text: string): string {
    const cmdId = randomId();
    this.send({ t: "cmd.submit", seq: 0, cmdId, text } as never);
    return cmdId;
  }

  respondPermission(reqId: string, allow: boolean): void {
    this.send({
      t: "perm.response",
      seq: 0,
      reqId,
      decision: allow ? "allow" : "deny",
      scope: "once",
    } as never);
  }

  requestTaskList(): void {
    this.send({ t: "task.list", seq: 0 } as never);
  }

  requestWorkspaceList(): void {
    this.send({ t: "workspace.list", seq: 0 } as never);
  }

  switchWorkspace(name: string): void {
    this.send({ t: "workspace.switch", seq: 0, name } as never);
  }

  // ---- memory / settings / history ---------------------------------------

  requestMemoryList(): void {
    this.send({ t: "memory.list", seq: 0 } as never);
  }

  updateMemory(key: string, value: string, category = "general"): void {
    this.send({ t: "memory.update", seq: 0, key, value, category } as never);
  }

  deleteMemory(key: string): void {
    this.send({ t: "memory.delete", seq: 0, key } as never);
  }

  requestSettings(): void {
    this.send({ t: "settings.get", seq: 0 } as never);
  }

  setSetting(key: string, value: unknown): void {
    this.send({ t: "settings.set", seq: 0, key, value } as never);
  }

  requestHistory(limit = 100): void {
    this.send({ t: "history.list", seq: 0, limit } as never);
  }

  // ---- workspace config / tmux / engines (Phase F) ------------------------

  setWorkspaceConfig(workspace: string, config: WorkspaceConfig): void {
    this.send({ t: "workspace.config.update", seq: 0, workspace, config } as never);
  }

  requestTmuxPanes(): void {
    this.send({ t: "tmux.pane.list", seq: 0 } as never);
  }

  requestEngines(): void {
    this.send({ t: "engine.list", seq: 0 } as never);
  }

  // ---- agents (Phase G — multi-session, resumable) -----------------------

  /** Ask the daemon for the current agent list. Daemon also pushes
   *  agent.state proactively whenever an agent is created/updated/deleted. */
  requestAgentList(): void {
    this.send({ t: "agent.list", seq: 0 } as never);
  }

  /** Create a new agent. Daemon spawns the executor (tmux by default) and
   *  pushes a fresh agent.state to all paired devices.
   *
   *  Pass `opts.agentId` to use a client-generated id (recommended): the phone
   *  can setSelectedAgentId(id) immediately without waiting for the daemon's
   *  agent.state push to learn the new id. Same pattern as CmdSubmit.cmdId.
   *  Pass `opts.title` to override the default (first_prompt.slice(0, 60)). */
  createAgent(
    workspace: string,
    engine: "claude" | "codex",
    firstPrompt: string,
    opts?: { agentId?: string; title?: string },
  ): void {
    this.send({
      t: "agent.create",
      seq: 0,
      workspace,
      engine,
      first_prompt: firstPrompt,
      agent_id: opts?.agentId,
      title: opts?.title,
    } as never);
  }

  /** Rename an existing agent. Daemon broadcasts a fresh agent.state after
   *  the update so every paired device sees the new title. */
  agentRename(agentId: string, title: string): void {
    this.send({ t: "agent.rename", seq: 0, agent_id: agentId, title } as never);
  }

  /** Send a follow-up message to an existing agent (resume). Daemon will
   *  inject via tmux send-keys (live session) or spawn with --resume <sid>. */
  agentMessage(agentId: string, text: string): void {
    this.send({ t: "agent.message", seq: 0, agent_id: agentId, text } as never);
  }

  /** Stop (kill tmux session / spawn) without deleting the record. */
  agentStop(agentId: string): void {
    this.send({ t: "agent.stop", seq: 0, agent_id: agentId } as never);
  }

  /** Delete the agent record (keeps underlying claude jsonl file). */
  deleteAgent(agentId: string): void {
    this.send({ t: "agent.delete", seq: 0, agent_id: agentId } as never);
  }

  /** Request historical messages for an agent (replay from jsonl). */
  requestAgentHistory(agentId: string, limit = 100): void {
    this.send({ t: "agent.history", seq: 0, agent_id: agentId, limit } as never);
  }

  /** Stop a task (or everything if taskId omitted). Goes through the reliable
   *  channel (seq via outbox) — a bare seq:0 would be dropped as a duplicate. */
  stopTask(taskId?: string): void {
    this.send({ t: "task.stop", seq: 0, taskId } as never);
  }

  // ---- voice ------------------------------------------------------------------

  startVoice(): void {
    this.voiceSeq = 0;
    this.sendVoice({ t: "voice.start", seq: 0, fmt: "pcm16k" });
  }

  sendVoiceChunk(dataB64: string): void {
    this.voiceSeq += 1;
    this.sendVoice({ t: "voice.chunk", seq: this.voiceSeq, data: dataB64 });
  }

  endVoice(): void {
    this.sendVoice({ t: "voice.end", seq: this.voiceSeq + 1 });
  }

  /** Voice family: fire-and-forget, kind:"voice", bypasses the reliable channel. */
  private sendVoice(p: Payload): void {
    this.relay.send(
      sealPayload(p, {
        room: this.state.room,
        from: this.state.deviceId,
        to: this.state.daemonDeviceId,
        kind: "voice",
        peer: {
          theirBoxPublic: fromB64(this.state.daemonBoxPub),
          myBoxPrivate: fromB64(this.state.boxPriv),
        },
      }),
    );
  }

  private send(p: Payload & { seq: number }): void {
    p.seq = this.outbox.add(p);
    this.state.sentSeq = p.seq;
    void saveState(this.state);
    this.relay.send(
      sealPayload(p, {
        room: this.state.room,
        from: this.state.deviceId,
        to: this.state.daemonDeviceId,
        peer: {
          theirBoxPublic: fromB64(this.state.daemonBoxPub),
          myBoxPrivate: fromB64(this.state.boxPriv),
        },
      }),
    );
  }

  private handle(payload: Payload): void {
    // TTS stream bypasses the reliable channel
    switch (payload.t) {
      case "tts.start":
        this.ttsChunks = [];
        this.ttsMime = payload.mime;
        this.ttsDurationMs = payload.durationMs ?? 0;
        this.ttsExpectReply = payload.expectReply ?? false;
        return;
      case "tts.chunk":
        this.ttsChunks.push(payload.data);
        return;
      case "tts.end":
        if (this.ttsChunks.length) {
          this.cb.onTtsReady?.(
            this.ttsChunks,
            this.ttsMime,
            this.ttsDurationMs,
            this.ttsExpectReply,
          );
          this.ttsChunks = [];
        }
        return;
      default:
        break;
    }

    if ("seq" in payload && payload.t !== "hello") {
      if (payload.seq <= this.state.lastSeq || !this.inbox.accept(payload.seq)) return;
      this.state.lastSeq = Math.max(this.state.lastSeq, payload.seq);
      void saveState(this.state);
      this.send({ t: "ack", upTo: this.state.lastSeq } as never);
    }
    switch (payload.t) {
      case "task.event":
        this.cb.onTaskEvent(payload);
        break;
      case "perm.request":
        this.cb.onPermRequest(payload);
        break;
      case "task.state":
        this.cb.onTaskState(payload.tasks);
        break;
      case "asr.final":
        this.cb.onAsrFinal?.(payload.text);
        break;
      case "workspace.state":
        this.cb.onWorkspaceState?.(payload.active, payload.workspaces);
        break;
      case "memory.state":
        this.cb.onMemoryState?.(payload.items);
        break;
      case "settings.state":
        this.cb.onSettingsState?.(payload.settings);
        break;
      case "history.state":
        this.cb.onHistoryState?.(payload.entries);
        break;
      case "workspace.config.state":
        this.cb.onWorkspaceConfigs?.(payload.configs);
        break;
      case "tmux.pane.state":
        this.cb.onTmuxPanes?.(payload.panes);
        break;
      case "engine.state":
        this.cb.onEngines?.(payload.engines);
        break;
      case "agent.state":
        this.cb.onAgentState?.(payload.agents);
        break;
      case "agent.history.state":
        this.cb.onAgentHistory?.(payload.agent_id, payload.entries);
        break;
      default:
        break;
    }
  }
}
