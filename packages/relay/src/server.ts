/**
 * Jarvis relay — a zero-knowledge forwarder.
 *
 * It sees: room ids (hashes), device ids, message sizes, timing.
 * It never sees: payload plaintext, encryption keys, room secrets.
 *
 * Responsibilities, in full:
 *  1. Challenge-sign auth (binds deviceId ↔ Ed25519 pubkey so `from` can't be spoofed).
 *  2. Route envelopes within a room.
 *  3. Queue `msg`/`pair` envelopes for offline devices (TTL + per-room size cap). `voice` is dropped.
 *  4. Tell room peers who's online.
 *
 * Run behind a TLS terminator (caddy/nginx) in production; plain ws on localhost for dev.
 */
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import {
  ClientFrame,
  Envelope,
  type ServerFrame,
  cryptoReady,
  fromB64,
  randomBytes,
  toB64,
  verifyDetached,
} from "@jarvis/protocol";

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? "relay.sqlite";
const QUEUE_TTL_MS = Number(process.env.QUEUE_TTL_HOURS ?? 72) * 3600_000;
const ROOM_QUEUE_CAP_BYTES = Number(process.env.ROOM_QUEUE_CAP_MB ?? 5) * 1024 * 1024;
const MAX_FRAME_BYTES = 512 * 1024;

interface Session {
  ws: WebSocket;
  deviceId: string;
  room: string;
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    to_device TEXT NOT NULL,
    env TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_queue_target ON queue(room, to_device);
  CREATE INDEX IF NOT EXISTS idx_queue_ts ON queue(ts);
`);

const stmtEnqueue = db.prepare(
  "INSERT INTO queue (room, to_device, env, bytes, ts) VALUES (?, ?, ?, ?, ?)",
);
const stmtDequeue = db.prepare(
  "SELECT id, env FROM queue WHERE room = ? AND to_device = ? ORDER BY id",
);
const stmtDelete = db.prepare("DELETE FROM queue WHERE id = ?");
const stmtExpire = db.prepare("DELETE FROM queue WHERE ts < ?");
const stmtRoomBytes = db.prepare(
  "SELECT COALESCE(SUM(bytes), 0) AS total FROM queue WHERE room = ?",
);

// room -> deviceId -> session (one live socket per device; newer wins)
const rooms = new Map<string, Map<string, Session>>();

function send(ws: WebSocket, frame: ServerFrame): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

function roomPeers(room: string): Map<string, Session> {
  let m = rooms.get(room);
  if (!m) {
    m = new Map();
    rooms.set(room, m);
  }
  return m;
}

function broadcastPresence(room: string): void {
  const peers = roomPeers(room);
  const online = [...peers.keys()];
  for (const s of peers.values()) send(s.ws, { t: "presence", online });
}

function deliverOrQueue(env: Envelope): void {
  const peers = roomPeers(env.room);
  const raw = JSON.stringify(env);
  const targets =
    env.to === "*" ? [...peers.keys()].filter((d) => d !== env.from) : [env.to];

  for (const target of targets) {
    const session = peers.get(target);
    if (session) {
      send(session.ws, { t: "recv", env });
    } else if (env.kind === "msg" || env.kind === "pair") {
      const used = (stmtRoomBytes.get(env.room) as { total: number }).total;
      if (used + raw.length <= ROOM_QUEUE_CAP_BYTES) {
        stmtEnqueue.run(env.room, target, raw, raw.length, Date.now());
      }
      // over cap: drop silently — E2E resume (Outbox replay) recovers when both sides are online
    }
  }
}

function flushQueue(session: Session): number {
  const pending = stmtDequeue.all(session.room, session.deviceId) as Array<{
    id: number;
    env: string;
  }>;
  for (const row of pending) {
    try {
      send(session.ws, { t: "recv", env: JSON.parse(row.env) });
    } catch {
      // corrupt row — drop it
    }
    stmtDelete.run(row.id);
  }
  return pending.length;
}

await cryptoReady();
setInterval(() => stmtExpire.run(Date.now() - QUEUE_TTL_MS), 600_000).unref();

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_FRAME_BYTES });

wss.on("connection", (ws) => {
  const challenge = randomBytes(32);
  let session: Session | null = null;
  send(ws, { t: "challenge", nonce: toB64(challenge) });

  const authTimer = setTimeout(() => {
    if (!session) ws.close(4001, "auth timeout");
  }, 10_000);

  ws.on("message", (data) => {
    let frame: ClientFrame;
    try {
      const parsed = ClientFrame.safeParse(JSON.parse(data.toString()));
      if (!parsed.success) {
        send(ws, { t: "error", reason: "bad frame" });
        return;
      }
      frame = parsed.data;
    } catch {
      send(ws, { t: "error", reason: "bad json" });
      return;
    }

    if (frame.t === "auth") {
      if (session) return;
      const ok = verifyDetached(frame.sig, challenge, fromB64(frame.signPub));
      if (!ok) {
        send(ws, { t: "auth.err", reason: "bad signature" });
        ws.close(4003, "auth failed");
        return;
      }
      clearTimeout(authTimer);
      session = { ws, deviceId: frame.deviceId, room: frame.room };
      const peers = roomPeers(frame.room);
      const old = peers.get(frame.deviceId);
      if (old) old.ws.close(4000, "superseded");
      peers.set(frame.deviceId, session);
      const queued = flushQueue(session);
      send(ws, { t: "auth.ok", queued });
      broadcastPresence(frame.room);
      console.log(`[relay] ${frame.deviceId} joined room ${frame.room.slice(0, 8)}… (queued=${queued})`);
      return;
    }

    if (frame.t === "send") {
      if (!session) {
        send(ws, { t: "error", reason: "not authed" });
        return;
      }
      const env = frame.env;
      // a device may only send as itself, into its own room
      if (env.from !== session.deviceId || env.room !== session.room) {
        send(ws, { t: "error", reason: "spoofed envelope" });
        return;
      }
      deliverOrQueue(env);
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimer);
    if (session) {
      const peers = roomPeers(session.room);
      if (peers.get(session.deviceId) === session) {
        peers.delete(session.deviceId);
        broadcastPresence(session.room);
      }
      if (peers.size === 0) rooms.delete(session.room);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT} (db=${DB_PATH})`);
});
