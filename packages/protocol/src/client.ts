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

/**
 * Heartbeat tuning. NAT/firewall idle timeouts typically clip in the 25-60s
 * range for home routers and even more aggressively on mobile carriers.
 * We ping well inside that window so the link always has fresh traffic.
 * The first ping fires immediately on auth (not after PING_INTERVAL_MS) so
 * we don't sit silent for 15s right after connecting — that silence is
 * exactly what NAT state tables age out on.
 */
const PING_INTERVAL_MS = 15_000;
const PONG_TIMEOUT_MS = 10_000;
/**
 * Master kill switch for the heartbeat. The heartbeat code itself is
 * correct (probe-verified: relay 17ms pong), but something in its
 * interaction with the daemon's event loop causes a 1Hz disconnect/reconnect
 * storm when enabled. Until that's root-caused, default OFF — daemon falls
 * back to the pre-heartbeat behavior (stable for hours, just no half-open
 * detection). Flip to true to re-enable for debugging.
 */
const HEARTBEAT_ENABLED = false;

export class RelayClient {
  private ws: WsLike | null = null;
  private closed = false;
  private attempt = 0;
  private up = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private waitingPong = false;
  /**
   * Once true, never send ping again. Set when an old relay rejects our
   * ping with `error: "bad frame"` (older ClientFrame schema didn't include
   * ping). Lets new clients coexist with un-upgraded relays instead of
   * spinning a reconnect loop every PING_INTERVAL_MS.
   */
  private heartbeatDisabled = false;

  constructor(private opts: RelayClientOpts) {}

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    this.stopHeartbeat();
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

  private startHeartbeat(ws: WsLike): void {
    this.stopHeartbeat();
    if (this.heartbeatDisabled) return;

    // Detect protocol-level ping support. Node's `ws` package exposes
    // `.ping()` and emits `'pong'` — this is the WebSocket control frame
    // (opcode 0x9/0xa) which RFC 6455 MANDATES peers respond to
    // automatically. Using it means we get keepalive even when the relay
    // hasn't been upgraded to understand our application-level `{t:"ping"}`
    // frame. RN's global WebSocket has no such API, so on RN we fall back
    // to the application-level ping path.
    const wsAny = ws as unknown as {
      ping?: (data?: unknown, mask?: boolean, failSilently?: boolean) => void;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    const supportsProtoPing = typeof wsAny.ping === "function";
    if (supportsProtoPing && typeof wsAny.on === "function") {
      // 'pong' fires when the peer acks our control-frame ping.
      wsAny.on("pong", () => {
        this.waitingPong = false;
        if (this.pongTimer) {
          clearTimeout(this.pongTimer);
          this.pongTimer = null;
        }
      });
    }

    this.pingTimer = setInterval(() => {
      this.sendPing(ws, wsAny, supportsProtoPing);
    }, PING_INTERVAL_MS);
    // Fire one ping immediately — covers the silent window right after auth
    // where NAT state tables are most likely to age out.
    this.sendPing(ws, wsAny, supportsProtoPing);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pingTimer = null;
    this.pongTimer = null;
    this.waitingPong = false;
  }

  /** Send one heartbeat ping (protocol-level if supported, else app-level). */
  private sendPing(
    ws: WsLike,
    wsAny: { ping?: (data?: unknown, mask?: boolean, failSilently?: boolean) => void },
    supportsProtoPing: boolean,
  ): void {
    if (!this.up || this.ws !== ws) return;
    // If we never got the previous pong, the link is half-open — force close.
    if (this.waitingPong) {
      this.log("missed pong — closing half-open link");
      this.forceClose(ws);
      return;
    }
    try {
      if (supportsProtoPing) {
        // Control-frame ping — relay MUST auto-reply per RFC 6455 §5.5.2.
        wsAny.ping!(undefined, true, true);
      } else {
        // Application-level ping — only works if relay has been upgraded
        // to recognize the `ping` ClientFrame; otherwise we'll get back an
        // `error: "bad frame"` and disable heartbeat (see onmessage).
        ws.send(JSON.stringify({ t: "ping" }));
      }
      this.waitingPong = true;
      // Safety net: if pong never lands within PONG_TIMEOUT_MS, force close.
      this.pongTimer = setTimeout(() => {
        if (this.waitingPong && this.ws === ws) {
          this.log("pong timeout — closing half-open link");
          this.forceClose(ws);
        }
      }, PONG_TIMEOUT_MS);
    } catch {
      // send threw — socket already torn down at the OS layer, but onclose
      // may not have fired yet. forceClose will tear down + onclose will
      // run the reconnect path.
      this.forceClose(ws);
    }
  }

  /**
   * Force a socket closed even when the OS-layer TCP is silent (half-open).
   *
   * IMPORTANT: this method only tears down the socket. It must NOT schedule
   * its own reconnect. terminate()/close() will fire onclose, which is the
   * single owner of the reconnect path. Scheduling a parallel reconnect
   * here causes a storm: both connects auth with the same deviceId, relay
   * supersede-closes the older one, its onclose schedules another connect,
   * … → ~1Hz reconnect loop forever.
   *
   * If terminate/close throws (already dead socket) we manually invoke the
   * onclose path once via `notifyClose()` since no event will fire.
   */
  private forceClose(ws: WsLike): void {
    if (!this.ws) return; // already torn down — idempotent
    this.stopHeartbeat();
    let toreDown = false;
    try {
      const anyWs = ws as unknown as {
        terminate?: () => void;
        close: (code?: number, reason?: string) => void;
      };
      if (typeof anyWs.terminate === "function") {
        anyWs.terminate(); // Node ws: synchronous destroy + 'close' event
        toreDown = true;
      } else {
        anyWs.close(); // RN: standard close, onclose fires async
        toreDown = true;
      }
    } catch {
      toreDown = false;
    }
    if (!toreDown) {
      // Socket was already gone — synthesize the close path ourselves.
      this.notifyClose(ws);
    }
    // else: onclose handler will run notifyClose and schedule reconnect.
  }

  /** Shared close handler used by both ws.onclose and forceClose fallback. */
  private notifyClose(ws: WsLike, code?: number, reason?: string): void {
    const wasUp = this.up;
    this.up = false;
    this.ws = null;
    this.stopHeartbeat();
    if (wasUp) this.opts.onDown?.();
    if (this.closed) return;
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt += 1;
    const closeInfo = code !== undefined ? ` (code=${code}${reason ? ` ${reason}` : ""})` : "";
    this.log(`disconnected${closeInfo}, retrying in ${delay}ms`);
    setTimeout(() => this.connect(), delay);
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
          // TODO: heartbeat temporarily disabled — see HEARTBEAT_ENABLED.
          if (HEARTBEAT_ENABLED) this.startHeartbeat(ws);
          break;
        case "auth.err":
          this.log(`auth rejected: ${frame.reason}`);
          this.closed = true; // a bad key never gets better — stop retrying
          this.stopHeartbeat();
          ws.close();
          break;
        case "pong":
          // Heartbeat reply — clear the waiting flag and the safety timer.
          this.waitingPong = false;
          if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
          }
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
          // Old relays (schema pre-ping) reject our `{t:"ping"}` frame as
          // "bad frame". Detect this once and disable heartbeat so we
          // coexist; otherwise we'd spin a reconnect every PING_INTERVAL_MS.
          if (this.waitingPong && /bad frame|unknown|unrecognized/i.test(frame.reason)) {
            this.heartbeatDisabled = true;
            this.waitingPong = false;
            if (this.pongTimer) {
              clearTimeout(this.pongTimer);
              this.pongTimer = null;
            }
            this.stopHeartbeat();
            this.log("relay does not support ping — heartbeat disabled (upgrade relay to enable)");
            return;
          }
          this.log(`relay error: ${frame.reason}`);
          break;
      }
    };

    ws.onclose = (ev?: unknown) => {
      // Single source of truth for the reconnect path. forceClose() relies
      // on this — it only tears down the socket and lets us schedule the
      // reconnect, so we never race two parallel connect attempts.
      // Node `ws` passes a CloseEvent with .code and .reason; RN passes
      // something CloseEvent-shaped too. Be defensive about both.
      const e = ev as { code?: number; reason?: string } | undefined;
      this.notifyClose(ws, e?.code, e?.reason);
    };

    ws.onerror = () => {
      // onclose follows; nothing to do here
    };
  }
}
