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

  /** Submit a command. sessionId is encoded into cmdId as
   *  `${sessionId}::${random}` so daemon round-trips it back in
   *  task.event. Phone parses cmdId to route replies to the correct
   *  session. This achieves per-session isolation WITHOUT protocol
   *  schema changes. */
  submitCommand(text: string, sessionId?: string): string {
    const suffix = randomId();
    const cmdId = sessionId ? `${sessionId}::${suffix}` : suffix;
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
      default:
        break;
    }
  }
}
