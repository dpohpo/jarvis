/**
 * Phone-side voice I/O.
 *
 * Capture: @picovoice/react-native-voice-processor (Apache-2.0, standalone —
 * no Picovoice account; verified API: start(frameLength, sampleRate),
 * addFrameListener(frame: number[]), stop(), hasRecordAudioPermission()).
 * Frames are 16kHz mono int16; we batch ~10 frames (~320ms) per encrypted chunk.
 *
 * Playback: assemble TTS chunks → cache file → expo-audio player.
 */
import { VoiceProcessor } from "@picovoice/react-native-voice-processor";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { toB64, fromB64 } from "@jarvis/protocol";

const FRAME_LENGTH = 512; // 32ms at 16kHz
const FRAMES_PER_CHUNK = 10;

// Poor-man's VAD: RMS energy gate. Tuned for hand-held phone distance;
// fails in loud environments (falls back to manual stop / max duration).
const VAD_SILENCE_RMS = 300; // int16 RMS below this = silence
const VAD_SILENCE_MS = 1400; // this much trailing silence ends the utterance
const VAD_MAX_MS = 15_000; // hard cap per utterance
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
  if (!capturing || !opts) return;
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
  const gaveUp = !heardSpeech && totalMs >= 6_000; // nobody spoke
  if (utteranceDone || gaveUp || totalMs >= VAD_MAX_MS) {
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
  if (!(await vp.hasRecordAudioPermission())) return false;
  frameBuf = [];
  opts = o;
  silenceMs = 0;
  totalMs = 0;
  heardSpeech = false;
  capturing = true;
  await vp.start(FRAME_LENGTH, 16000);
  return true;
}

export async function stopCapture(): Promise<void> {
  if (!capturing) return;
  capturing = false;
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
