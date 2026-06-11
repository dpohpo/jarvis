/**
 * Reconnecting relay client, isomorphic over any browser-style WebSocket
 * (`ws` in Node, the global WebSocket in React Native — both expose on* handlers).
 */
import {
  type Envelope,
  Envelope as EnvelopeSchema,
} from "./envelope.js";
import { ServerFrame } from "./relaywire.js";
import { fromB64, signDetached } from "./crypto.js";

export interface WsLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
}

export interface RelayClientOpts {
  url: string;
  deviceId: string;
  room: string;
  signPublicB64: string;
  signPrivate: Uint8Array;
  makeWebSocket: (url: string) => WsLike;
  onEnvelope: (env: Envelope) => void;
  onPresence?: (online: string[]) => void;
  onUp?: (queued: number) => void;
  onDown?: () => void;
  log?: (msg: string) => void;
}

const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

export class RelayClient {
  private ws: WsLike | null = null;
  private closed = false;
  private attempt = 0;
  private up = false;

  constructor(private opts: RelayClientOpts) {}

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    this.ws?.close();
  }

  get isUp(): boolean {
    return this.up;
  }

  /** Send an envelope. Returns false if the link is down (caller's Outbox covers the gap). */
  send(env: Envelope): boolean {
    if (!this.ws || !this.up) return false;
    try {
      this.ws.send(JSON.stringify({ t: "send", env }));
      return true;
    } catch {
      return false;
    }
  }

  private log(msg: string): void {
    this.opts.log?.(msg);
  }

  private connect(): void {
    if (this.closed) return;
    const ws = this.opts.makeWebSocket(this.opts.url);
    this.ws = ws;

    ws.onopen = () => {
      this.log(`connected to ${this.opts.url}, waiting for challenge`);
    };

    ws.onmessage = (ev) => {
      let frame: ServerFrame;
      try {
        const parsed = ServerFrame.safeParse(JSON.parse(String(ev.data)));
        if (!parsed.success) return;
        frame = parsed.data;
      } catch {
        return;
      }

      switch (frame.t) {
        case "challenge": {
          const sig = signDetached(fromB64(frame.nonce), this.opts.signPrivate);
          ws.send(
            JSON.stringify({
              t: "auth",
              deviceId: this.opts.deviceId,
              room: this.opts.room,
              signPub: this.opts.signPublicB64,
              sig,
            }),
          );
          break;
        }
        case "auth.ok":
          this.up = true;
          this.attempt = 0;
          this.log(`authed (${frame.queued} queued envelopes incoming)`);
          this.opts.onUp?.(frame.queued);
          break;
        case "auth.err":
          this.log(`auth rejected: ${frame.reason}`);
          this.closed = true; // a bad key never gets better — stop retrying
          ws.close();
          break;
        case "recv": {
          const env = EnvelopeSchema.safeParse(frame.env);
          if (env.success) this.opts.onEnvelope(env.data);
          break;
        }
        case "presence":
          this.opts.onPresence?.(frame.online);
          break;
        case "error":
          this.log(`relay error: ${frame.reason}`);
          break;
      }
    };

    ws.onclose = () => {
      const wasUp = this.up;
      this.up = false;
      this.ws = null;
      if (wasUp) this.opts.onDown?.();
      if (this.closed) return;
      const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
      this.attempt += 1;
      this.log(`disconnected, retrying in ${delay}ms`);
      setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => {
      // onclose follows; nothing to do here
    };
  }
}
