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
      default:
        break;
    }
  }
}
