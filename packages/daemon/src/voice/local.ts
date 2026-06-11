/**
 * Local-first ASR/TTS with layered fallbacks (冗余安全原则):
 *   ASR: voiced sidecar (faster-whisper) → GLM cloud
 *   TTS: Qwen3-TTS local server → macOS `say` → GLM cloud
 */
import { spawn, execFile } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanForTts,
  transcribe as glmTranscribe,
  synthesize as glmSynthesize,
} from "./zhipu.js";

const ASR_PORT = Number(process.env.JARVIS_ASR_PORT ?? 8898);
const QWEN_TTS = "http://127.0.0.1:8888";
const log = (m: string) => console.log(`[voice] ${m}`);

// ---- voiced sidecar lifecycle ------------------------------------------------

let sidecarStarted = false;

export function ensureAsrSidecar(): void {
  if (sidecarStarted) return;
  sidecarStarted = true;
  const script = join(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../voiced/asr_server.py",
  );
  const child = spawn("python3", [script], {
    stdio: ["ignore", "inherit", "inherit"],
    detached: false,
  });
  child.on("error", (e) => log(`asr sidecar failed to start: ${e}`));
  child.on("exit", (code) => {
    log(`asr sidecar exited (${code})`);
    sidecarStarted = false;
  });
}

// ---- ASR ----------------------------------------------------------------------

async function localAsr(wav: Uint8Array): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${ASR_PORT}/asr`, {
    method: "POST",
    body: Buffer.from(wav),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`local asr ${res.status}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

export async function transcribeAny(wav: Uint8Array): Promise<string> {
  try {
    const text = await localAsr(wav);
    log(`asr(local): '${text}'`);
    return text;
  } catch (e) {
    log(`local asr unavailable (${String(e).slice(0, 80)}), trying GLM cloud`);
  }
  const text = await glmTranscribe(wav);
  log(`asr(glm): '${text}'`);
  return text;
}

// ---- TTS ----------------------------------------------------------------------

async function qwenTts(text: string): Promise<Uint8Array> {
  const res = await fetch(
    `${QWEN_TTS}/say?text=${encodeURIComponent(text)}&language=auto`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) throw new Error(`qwen tts ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length <= 44) throw new Error("qwen tts empty audio");
  return buf;
}

/** macOS built-in voice — the always-works last local resort. */
async function sayTts(text: string): Promise<Uint8Array> {
  const aiff = join(homedir(), ".jarvis", `tts-${Date.now()}.aiff`);
  const wav = aiff.replace(/\.aiff$/, ".wav");
  const run = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });
  try {
    await run("say", ["-o", aiff, text.slice(0, 1000)]);
    await run("afconvert", ["-f", "WAVE", "-d", "LEI16@22050", "-c", "1", aiff, wav]);
    return new Uint8Array(readFileSync(wav));
  } finally {
    rmSync(aiff, { force: true });
    rmSync(wav, { force: true });
  }
}

export async function synthesizeAny(raw: string): Promise<Uint8Array | null> {
  const text = cleanForTts(raw);
  if (!text) return null;
  try {
    const wav = await qwenTts(text);
    log(`tts(qwen): ${wav.length} bytes`);
    return wav;
  } catch (e) {
    log(`qwen tts unavailable (${String(e).slice(0, 80)}), trying say`);
  }
  try {
    const wav = await sayTts(text);
    log(`tts(say): ${wav.length} bytes`);
    return wav;
  } catch (e) {
    log(`say failed (${String(e).slice(0, 80)}), trying GLM cloud`);
  }
  return glmSynthesize(text);
}
