/**
 * Phone-side voice I/O.
 *
 * Capture paths:
 *  - **VAD mode (preferred)**: SherpaVad Expo Module drives its own
 *    AudioRecord + Silero VAD. Emits chunk / speechend / error events.
 *    Accurate neural-network end-of-speech detection; no fixed time cap.
 *  - **VAD fallback (RMS)**: if SherpaVad fails to init, we fall back to a
 *    poor-man's RMS energy gate via @picovoice/react-native-voice-processor.
 *    Time cap is removed here too, but accuracy is worse.
 *  - **Hold/tap mode (no VAD)**: same Picovoice path, RMS gate disabled, the
 *    caller decides when to stop.
 *
 * Playback: assemble TTS chunks → cache file → expo-audio player.
 */
import { VoiceProcessor } from "@picovoice/react-native-voice-processor";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { toB64, fromB64 } from "@jarvis/protocol";
import SherpaVad from "sherpa-vad";

const FRAME_LENGTH = 512; // 32ms at 16kHz
const FRAMES_PER_CHUNK = 10;

// Poor-man's VAD (RMS fallback): only used when SherpaVad fails to init.
// Tuned to be lenient — the goal is to never interrupt mid-utterance.
const VAD_SILENCE_RMS = 200;     // int16 RMS below this = silence (was 300)
const VAD_SILENCE_MS = 1800;     // trailing silence to end (was 1400)
const VAD_GIVEUP_MS = 30_000;    // bail if nobody spoke (was 6_000; bumped
                                 // because false starts are better than
                                 // the daemon never getting a turn)
// No hard utterance cap — user explicitly asked for unlimited duration.
const FRAME_MS = 32;

export interface CaptureOpts {
  onChunk: (b64: string) => void;
  /** Called when VAD (or the max-duration cap) decides the utterance is over. */
  onAutoEnd?: () => void;
  /** Enable the energy VAD (conversation mode). Hold/tap mode leaves it off. */
  vad?: boolean;
}

const vp = VoiceProcessor.instance;
let frameBuf: number[][] = [];
let opts: CaptureOpts | null = null;
let capturing = false;
let silenceMs = 0;
let totalMs = 0;
let heardSpeech = false;

// ---- SherpaVad (preferred VAD path) ----------------------------------------

/** null = untested, true = ready, false = unavailable (use RMS fallback). */
let sherpaReady: boolean | null = null;
let usingSherpa = false;
let chunkListener: { remove: () => void } | null = null;
let endListener: { remove: () => void } | null = null;
let errListener: { remove: () => void } | null = null;

async function ensureSherpa(): Promise<boolean> {
  if (sherpaReady !== null) return sherpaReady;
  try {
    sherpaReady = await SherpaVad.init({
      threshold: 0.5,
      minSilenceDuration: 1.0,    // user asked for "about 1 second"
      minSpeechDuration: 0.1,
      maxSpeechDuration: 3600,    // effectively no cap
    });
    if (!sherpaReady) console.warn("[voice] SherpaVad.init returned false");
  } catch (e) {
    console.warn("[voice] SherpaVad.init threw, falling back to RMS:", e);
    sherpaReady = false;
  }
  return sherpaReady;
}

function detachSherpaListeners(): void {
  chunkListener?.remove();
  endListener?.remove();
  errListener?.remove();
  chunkListener = endListener = errListener = null;
}

async function startSherpa(o: CaptureOpts): Promise<boolean> {
  chunkListener = SherpaVad.addListener("chunk", ({ b64 }) => {
    if (capturing && opts) opts.onChunk(b64);
  });
  endListener = SherpaVad.addListener("speechend", () => {
    if (capturing && opts) {
      const cb = opts.onAutoEnd;
      capturing = false;
      detachSherpaListeners();
      void SherpaVad.stop();
      cb?.();
    }
  });
  errListener = SherpaVad.addListener("error", ({ message }) => {
    console.error("[voice] SherpaVad error:", message);
    if (capturing && opts) {
      // Treat fatal error as end-of-utterance so the UI doesn't hang.
      const cb = opts.onAutoEnd;
      capturing = false;
      detachSherpaListeners();
      cb?.();
    }
  });

  const started = await SherpaVad.start();
  if (!started) {
    detachSherpaListeners();
    return false;
  }
  opts = o;
  capturing = true;
  usingSherpa = true;
  return true;
}

// ---- RMS helpers (only used when SherpaVad isn't available) ----------------

function rms(frame: number[]): number {
  let sum = 0;
  for (const s of frame) sum += s * s;
  return Math.sqrt(sum / frame.length);
}

function flushFrames(): void {
  if (!frameBuf.length || !opts) return;
  const all = new Int16Array(frameBuf.length * FRAME_LENGTH);
  frameBuf.forEach((f, i) => all.set(f, i * FRAME_LENGTH));
  frameBuf = [];
  opts.onChunk(toB64(new Uint8Array(all.buffer)));
}

vp.addFrameListener((frame: number[]) => {
  if (!capturing || !opts || usingSherpa) return;
  frameBuf.push(frame);
  if (frameBuf.length >= FRAMES_PER_CHUNK) flushFrames();

  if (!opts.vad) return;
  totalMs += FRAME_MS;
  if (rms(frame) >= VAD_SILENCE_RMS) {
    heardSpeech = true;
    silenceMs = 0;
  } else {
    silenceMs += FRAME_MS;
  }
  const utteranceDone = heardSpeech && silenceMs >= VAD_SILENCE_MS;
  const gaveUp = !heardSpeech && totalMs >= VAD_GIVEUP_MS;
  if (utteranceDone || gaveUp) {
    const cb = opts.onAutoEnd;
    capturing = false; // stop feeding before the async stop completes
    void vp.stop().then(() => {
      flushFrames();
      cb?.();
    });
  }
});

export async function startCapture(o: CaptureOpts): Promise<boolean> {
  if (capturing) return true;

  // VAD mode: try neural-network end-pointing first.
  if (o.vad && (await ensureSherpa())) {
    const ok = await startSherpa(o);
    if (ok) return true;
    // fall through to RMS path
  }

  // RMS path (VAD fallback or hold/tap mode).
  if (!(await vp.hasRecordAudioPermission())) return false;
  frameBuf = [];
  opts = o;
  silenceMs = 0;
  totalMs = 0;
  heardSpeech = false;
  usingSherpa = false;
  capturing = true;
  await vp.start(FRAME_LENGTH, 16000);
  return true;
}

export async function stopCapture(): Promise<void> {
  if (!capturing) return;
  capturing = false;

  if (usingSherpa) {
    detachSherpaListeners();
    try {
      await SherpaVad.stop();
    } catch (e) {
      console.warn("[voice] SherpaVad.stop threw:", e);
    }
    usingSherpa = false;
    opts = null;
    return;
  }

  await vp.stop();
  flushFrames();
  opts = null;
}

// ---- playback -----------------------------------------------------------------

let audioModeSet = false;

export async function playTtsWav(chunksB64: string[]): Promise<void> {
  if (!audioModeSet) {
    await setAudioModeAsync({ playsInSilentMode: true });
    audioModeSet = true;
  }
  const parts = chunksB64.map((c) => fromB64(c));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    merged.set(p, off);
    off += p.length;
  }
  const file = new File(Paths.cache, `tts-${Date.now()}.wav`);
  file.write(toB64(merged), { encoding: "base64" });
  const player = createAudioPlayer({ uri: file.uri });
  player.play();
}
