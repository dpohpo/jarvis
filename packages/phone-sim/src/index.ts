/**
 * Phone simulator — exercises the exact protocol path the real APK will use:
 * pair (sealed box) → encrypted channel → cmd.submit → streamed task.events →
 * perm.request/response round-trip.
 *
 * Usage:
 *   tsx src/index.ts pair '<json from `daemon pair`>'
 *   tsx src/index.ts cmd "把当前目录的文件列出来"
 *   tsx src/index.ts cmd-approve "sudo something"   (auto-approves Tier 3, for testing)
 *   tsx src/index.ts tasks
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { ulid } from "ulid";
import {
  Inbox,
  Outbox,
  type Payload,
  RelayClient,
  bytesToUtf8,
  cryptoReady,
  fromB64,
  generateIdentity,
  openPayload,
  pairEnvelope,
  seal,
  sealPayload,
  toB64,
  utf8ToBytes,
} from "@jarvis/protocol/node";

interface SimState {
  deviceId: string;
  boxPub: string;
  boxPriv: string;
  signPub: string;
  signPriv: string;
  relayUrl: string;
  room: string;
  daemonDeviceId: string;
  daemonBoxPub: string;
  paired: boolean;
  /** Highest daemon seq we've processed — sent as hello.resumeFrom so replay starts there. */
  lastSeq?: number;
  /** Highest seq we've sent — outbox must continue from here after restart. */
  sentSeq?: number;
}

const DIR = join(homedir(), ".jarvis");
const FILE = join(DIR, "phone-sim.json");

await cryptoReady();

const [, , command, ...rest] = process.argv;
const arg = rest.join(" ");

function load(): SimState {
  if (!existsSync(FILE)) {
    console.error("not paired yet — run `pair '<json>'` first");
    process.exit(1);
  }
  return JSON.parse(readFileSync(FILE, "utf8")) as SimState;
}

function save(s: SimState): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
}

if (command === "pair") {
  const info = JSON.parse(arg) as Record<string, string>;
  const id = generateIdentity();
  const s: SimState = {
    deviceId: `phone-sim-${ulid().slice(-6).toLowerCase()}`,
    boxPub: toB64(id.box.publicKey),
    boxPriv: toB64(id.box.privateKey),
    signPub: toB64(id.sign.publicKey),
    signPriv: toB64(id.sign.privateKey),
    relayUrl: info.relayUrl!,
    room: info.room!,
    daemonDeviceId: info.daemonDeviceId!,
    daemonBoxPub: info.daemonBoxPub!,
    paired: false,
  };

  const pairReq = {
    t: "pair.request",
    token: info.token!,
    deviceName: "Phone Simulator",
    boxPub: s.boxPub,
    signPub: s.signPub,
  };
  const sealed = seal(utf8ToBytes(JSON.stringify(pairReq)), fromB64(s.daemonBoxPub));

  const client = makeClient(s, (payload) => {
    if (payload.t === "pair.accept") {
      s.paired = true;
      save(s);
      console.log(`✅ 配对成功: ${s.deviceId} ↔ ${payload.daemonName}`);
      client.stop();
      process.exit(0);
    }
  });
  client.start();
  awaitUp(client).then(() => {
    client.send(pairEnvelope(s.room, s.deviceId, s.daemonDeviceId, sealed));
    console.log("pair request sent, waiting for daemon…");
  });
  setTimeout(() => {
    console.error("配对超时");
    process.exit(1);
  }, 15_000);
} else if (command === "voice") {
  // Simulate the phone's voice path: stream a 16kHz mono PCM16 WAV as
  // voice chunks, then print asr.final and save the TTS reply to /tmp.
  const s = load();
  const wav = readFileSync(arg);
  const pcm = wav.subarray(44); // assume canonical 44-byte header
  const ttsParts: Buffer[] = [];

  const client = makeClient(s, (payload) => {
    switch (payload.t) {
      case "asr.final":
        console.log(`🎤 识别结果: ${payload.text || "(空)"}`);
        break;
      case "task.event": {
        const tag = payload.ev.toUpperCase().padEnd(9);
        console.log(`  [${tag}] ${payload.data.slice(0, 500)}`);
        break;
      }
      case "tts.start":
        ttsParts.length = 0;
        break;
      case "tts.chunk":
        ttsParts.push(Buffer.from(payload.data, "base64"));
        break;
      case "tts.end": {
        const out = Buffer.concat(ttsParts);
        writeFileSync("/tmp/jarvis-tts-reply.wav", out);
        console.log(`🔊 TTS回复已保存: /tmp/jarvis-tts-reply.wav (${out.length} bytes)`);
        client.stop();
        process.exit(0);
      }
      default:
        break;
    }
  });

  function sendVoice(p: Record<string, unknown>): void {
    const env = sealPayload(p as never, {
      room: s.room,
      from: s.deviceId,
      to: s.daemonDeviceId,
      kind: "voice",
      peer: { theirBoxPublic: fromB64(s.daemonBoxPub), myBoxPrivate: fromB64(s.boxPriv) },
    });
    client.send(env);
  }

  client.start();
  awaitUp(client).then(() => {
    console.log(`📤 流式发送语音: ${arg} (${pcm.length} bytes PCM)`);
    sendVoice({ t: "voice.start", seq: 0, fmt: "pcm16k" });
    const CHUNK = 32 * 1024;
    let seq = 0;
    for (let off = 0; off < pcm.length; off += CHUNK) {
      seq += 1;
      sendVoice({ t: "voice.chunk", seq, data: pcm.subarray(off, off + CHUNK).toString("base64") });
    }
    sendVoice({ t: "voice.end", seq: seq + 1 });
  });
  setTimeout(() => {
    console.error("语音回路超时(300s)");
    process.exit(1);
  }, 300_000);
} else if (command === "stop") {
  // tsx src/index.ts stop [taskId]   (no id = stop everything)
  const s = load();
  const outbox = new Outbox<Payload>(s.sentSeq ?? 0);
  const client = makeClient(s, () => {});
  function sendP(p: Payload & { seq: number }): void {
    p.seq = outbox.add(p);
    s.sentSeq = p.seq;
    save(s);
    client.send(
      sealPayload(p, {
        room: s.room,
        from: s.deviceId,
        to: s.daemonDeviceId,
        peer: { theirBoxPublic: fromB64(s.daemonBoxPub), myBoxPrivate: fromB64(s.boxPriv) },
      }),
    );
  }
  client.start();
  awaitUp(client).then(() => {
    sendP({ t: "task.stop", seq: 0, taskId: arg || undefined } as never);
    console.log(`🛑 已发送停止指令 ${arg ? `(task ${arg})` : "(全部)"}`);
    setTimeout(() => process.exit(0), 1500);
  });
} else if (command === "ws" || command === "workspace") {
  // tsx src/index.ts ws [list|current|switch <name>]
  // No arg or "current" → query state. "list" → query state (same reply).
  // "switch <name>" → switch active workspace; empty name resets to root.
  const s = load();
  const outbox = new Outbox<Payload>(s.sentSeq ?? 0);
  const inbox = new Inbox();
  const sub = rest[0] ?? "current";
  const wsArg = rest.slice(1).join(" ").trim();

  const client = makeClient(s, (payload) => {
    if ("seq" in payload && payload.t !== "hello") {
      if (payload.seq <= (s.lastSeq ?? 0) || !inbox.accept(payload.seq)) return;
      s.lastSeq = Math.max(s.lastSeq ?? 0, payload.seq);
      save(s);
      sendPayload({ t: "ack", upTo: s.lastSeq } as never);
    }

    switch (payload.t) {
      case "workspace.state": {
        const active = payload.active || "<root>";
        console.log(`当前 workspace: ${active}`);
        console.log(`所有 workspaces:`);
        if (payload.workspaces.length === 0) {
          console.log("  (空 — 还没有子目录)");
        } else {
          payload.workspaces.forEach((w) => {
            const mark = w === payload.active ? " ← 当前" : "";
            console.log(`  - ${w}${mark}`);
          });
        }
        client.stop();
        process.exit(0);
        break;
      }
      default:
        break;
    }
  });

  function sendPayload(p: Payload & { seq: number }): void {
    p.seq = outbox.add(p);
    s.sentSeq = p.seq;
    save(s);
    const env = sealPayload(p, {
      room: s.room,
      from: s.deviceId,
      to: s.daemonDeviceId,
      peer: { theirBoxPublic: fromB64(s.daemonBoxPub), myBoxPrivate: fromB64(s.boxPriv) },
    });
    client.send(env);
  }

  client.start();
  awaitUp(client).then(() => {
    sendPayload({
      t: "hello",
      seq: 0,
      resumeFrom: s.lastSeq ?? 0,
      deviceName: "Phone Simulator",
    } as never);
    if (sub === "switch") {
      console.log(`📤 切换 workspace → '${wsArg || "<root>"}'`);
      sendPayload({ t: "workspace.switch", seq: 0, name: wsArg } as never);
    } else {
      sendPayload({ t: "workspace.list", seq: 0 } as never);
    }
  });
  setTimeout(() => {
    console.error("workspace 命令超时");
    process.exit(1);
  }, 15_000);
} else if (command === "cmd" || command === "cmd-approve" || command === "tasks") {
  const s = load();
  const outbox = new Outbox<Payload>(s.sentSeq ?? 0);
  const inbox = new Inbox();
  const autoApprove = command === "cmd-approve";
  const myCmdId = ulid();

  const client = makeClient(s, (payload) => {
    if ("seq" in payload && payload.t !== "hello") {
      if (payload.seq <= (s.lastSeq ?? 0) || !inbox.accept(payload.seq)) return;
      s.lastSeq = Math.max(s.lastSeq ?? 0, payload.seq);
      save(s);
      sendPayload({ t: "ack", upTo: s.lastSeq } as never);
    }

    switch (payload.t) {
      case "task.event": {
        // replayed events from earlier sessions can arrive first — only our own
        // command's terminal event ends the process
        const mine = payload.cmdId === myCmdId;
        const tag = payload.ev.toUpperCase().padEnd(9);
        console.log(`  [${tag}${mine ? "" : " (历史)"}] ${payload.data.slice(0, 2000)}`);
        if (mine && (payload.ev === "done" || payload.ev === "error")) {
          console.log(payload.ev === "done" ? "\n✅ 任务完成" : "\n❌ 任务失败");
          client.stop();
          process.exit(payload.ev === "done" ? 0 : 1);
        }
        break;
      }
      case "perm.request": {
        console.log(`\n🔐 审批请求 [Tier ${payload.tier}] ${payload.summary}`);
        console.log(payload.detail);
        const decision = autoApprove ? "allow" : "deny";
        console.log(`→ 模拟器自动回复: ${decision}\n`);
        sendPayload({ t: "perm.response", seq: 0, reqId: payload.reqId, decision, scope: "once" });
        break;
      }
      case "task.state":
        console.log(JSON.stringify(payload.tasks, null, 2));
        client.stop();
        process.exit(0);
        break;
      default:
        break;
    }
  });

  function sendPayload(p: Payload & { seq: number }): void {
    p.seq = outbox.add(p);
    s.sentSeq = p.seq;
    save(s);
    const env = sealPayload(p, {
      room: s.room,
      from: s.deviceId,
      to: s.daemonDeviceId,
      peer: { theirBoxPublic: fromB64(s.daemonBoxPub), myBoxPrivate: fromB64(s.boxPriv) },
    });
    client.send(env);
  }

  client.start();
  awaitUp(client).then(() => {
    sendPayload({
      t: "hello",
      seq: 0,
      resumeFrom: s.lastSeq ?? 0,
      deviceName: "Phone Simulator",
    } as never);
    if (command === "tasks") {
      sendPayload({ t: "task.list", seq: 0 });
    } else {
      console.log(`📤 发送指令: ${arg}\n`);
      sendPayload({ t: "cmd.submit", seq: 0, cmdId: myCmdId, text: arg });
    }
  });
} else {
  console.log("usage: pair '<json>' | cmd <text> | cmd-approve <text> | tasks | ws [list|current|switch <name>] | voice <wav> | stop [taskId]");
  process.exit(1);
}

function makeClient(s: SimState, onPayload: (p: Payload) => void): RelayClient {
  return new RelayClient({
    url: s.relayUrl,
    deviceId: s.deviceId,
    room: s.room,
    signPublicB64: s.signPub,
    signPrivate: fromB64(s.signPriv),
    makeWebSocket: (url) => new WebSocket(url) as never,
    onEnvelope: (env) => {
      const payload = openPayload(env, {
        theirBoxPublic: fromB64(s.daemonBoxPub),
        myBoxPrivate: fromB64(s.boxPriv),
      });
      if (payload) onPayload(payload);
    },
  });
}

function awaitUp(client: RelayClient): Promise<void> {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (client.isUp) {
        clearInterval(iv);
        resolve();
      }
    }, 50);
  });
}
