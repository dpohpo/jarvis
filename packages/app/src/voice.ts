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

const vp = VoiceProcessor.instance;
let frameBuf: number[][] = [];
let onChunkCb: ((b64: string) => void) | null = null;
let capturing = false;

function flushFrames(): void {
  if (!frameBuf.length || !onChunkCb) return;
  const all = new Int16Array(frameBuf.length * FRAME_LENGTH);
  frameBuf.forEach((f, i) => all.set(f, i * FRAME_LENGTH));
  frameBuf = [];
  onChunkCb(toB64(new Uint8Array(all.buffer)));
}

vp.addFrameListener((frame: number[]) => {
  if (!capturing) return;
  frameBuf.push(frame);
  if (frameBuf.length >= FRAMES_PER_CHUNK) flushFrames();
});

export async function startCapture(onChunk: (b64: string) => void): Promise<boolean> {
  if (capturing) return true;
  if (!(await vp.hasRecordAudioPermission())) return false;
  frameBuf = [];
  onChunkCb = onChunk;
  capturing = true;
  await vp.start(FRAME_LENGTH, 16000);
  return true;
}

export async function stopCapture(): Promise<void> {
  if (!capturing) return;
  capturing = false;
  await vp.stop();
  flushFrames();
  onChunkCb = null;
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
