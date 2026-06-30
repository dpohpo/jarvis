/**
 * SherpaVad — sherpa-onnx Silero VAD wrapper.
 *
 * Why a separate Expo Module instead of RMS in voice.ts:
 *  - Silero VAD is a neural network; far more accurate than energy threshold
 *    on Chinese aspirated consonants, low tones, breath pauses.
 *  - Internal AudioRecord (no per-frame RN bridge call) — same pattern as
 *    sherpa-wake, so existing mic coordination (start recording → stop wake)
 *    works unchanged.
 *
 * Events:
 *  - "chunk"     { b64 }: 320ms batched PCM16 base64, fed straight to the
 *                          daemon voice stream (same wire format as VoiceProcessor)
 *  - "speechend" { start, end }: Silero detected end-of-utterance (configurable
 *                          via minSilenceDuration passed to init())
 *  - "error"     { message }: fatal native error (model load fail, AudioRecord
 *                          init fail). Caller should fall back to RMS path.
 *
 * Lifecycle:
 *   init() → start() → (events flow) → stop()
 *   destroy() releases the model.
 */
import { requireNativeModule } from "expo-modules-core";

type ChunkEvent = { b64: string };
type SpeechEndEvent = { start: number; end: number };
type ErrorEvent = { message: string };

export interface SherpaVadModule {
  /**
   * Load silero_vad.onnx from Android assets.
   * Pass tunable params; sensible defaults if omitted.
   * Returns false on any failure (caller should fall back to RMS).
   */
  init(opts?: {
    threshold?: number;          // default 0.5
    minSilenceDuration?: number; // seconds, default 1.0
    minSpeechDuration?: number;  // seconds, default 0.1
    maxSpeechDuration?: number;  // seconds, default 3600 (effectively no cap)
  }): Promise<boolean>;

  /** Start AudioRecord + VAD loop. Idempotent (no-op if already running). */
  start(): Promise<boolean>;

  /** Stop VAD loop and release AudioRecord. Keeps the model loaded. */
  stop(): Promise<boolean>;

  /** Release everything including the VAD model. */
  destroy(): Promise<boolean>;

  addListener(eventName: "chunk", listener: (e: ChunkEvent) => void): { remove: () => void };
  addListener(eventName: "speechend", listener: (e: SpeechEndEvent) => void): { remove: () => void };
  addListener(eventName: "error", listener: (e: ErrorEvent) => void): { remove: () => void };
}

export default requireNativeModule<SherpaVadModule>("SherpaVad");
