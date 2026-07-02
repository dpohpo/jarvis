/**
 * Wake-word detection ("Jarvis") via the locally-written SherpaWakeModule
 * (Expo Module wrapping sherpa-onnx KeywordSpotter).
 *
 * Why sherpa-onnx instead of Picovoice Porcupine:
 *  - Picovoice requires an AccessKey from console.picovoice.ai; registration
 *    never delivered the activation email after multiple attempts.
 *  - sherpa-onnx is Apache-2.0, account-free, runs fully offline, and the
 *    zipformer-gigaspeech 3.3M model can spell JARVIS from BPE tokens
 *    (J=299, A=25, R=24, V=97, I=36, S=3 — all present in tokens.txt).
 *
 * The model + keywords.txt are bundled under
 *   android/app/src/main/assets/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/
 *
 * Mic coordination: SherpaWake owns its own AudioRecord (16kHz mono PCM16).
 * voice.ts drives @picovoice/react-native-voice-processor. Android allows
 * concurrent AudioRecords, but to be safe the caller should toggle:
 * start recording → stop wake → ... → stop recording → start wake.
 */
import SherpaWake from "sherpa-wake";

let wakeListener: { remove: () => void } | null = null;
let onWakeCb: (() => void) | null = null;
let ready = false;
let listening = false;

/** True once the model has been successfully loaded. */
export function isWakeReady(): boolean {
  return ready;
}

export function isListening(): boolean {
  return listening;
}

/** Load the KWS model from Android assets and register the wake listener.
 *  Idempotent: safe to call multiple times. Returns false on failure. */
export async function initWake(onWake: () => void): Promise<boolean> {
  if (ready) {
    onWakeCb = onWake;
    return true;
  }
  onWakeCb = onWake;
  // Subscribe before init so we never miss the first hit.
  if (!wakeListener) {
    wakeListener = SherpaWake.addListener("wake", () => {
      onWakeCb?.();
    });
  }
  try {
    ready = await SherpaWake.init();
    if (!ready) {
      console.error("[wake] SherpaWake.init() returned false");
    }
    return ready;
  } catch (e) {
    console.error("[wake] init failed:", String(e));
    ready = false;
    return false;
  }
}

/** Start background AudioRecord + KWS loop. No-op if already running. */
export async function startListening(): Promise<boolean> {
  if (!ready || listening) return listening;
  try {
    const ok = await SherpaWake.start();
    listening = ok;
    return ok;
  } catch (e) {
    console.error("[wake] start failed:", String(e));
    return false;
  }
}

/** Stop the KWS loop and release the AudioRecord. Keeps the model loaded
 *  so subsequent startListening() is fast. */
export async function pauseListening(): Promise<void> {
  if (!listening) return;
  try {
    await SherpaWake.stop();
  } catch (e) {
    console.error("[wake] stop failed:", String(e));
  }
  listening = false;
}

/** Fully release the model + audio resources. Call when the feature is
 *  turned off for good (e.g. user toggled the switch to off). */
export async function destroyWake(): Promise<void> {
  try {
    if (listening) await SherpaWake.stop();
    await SherpaWake.destroy();
  } catch (e) {
    console.error("[wake] destroy failed:", String(e));
  }
  wakeListener?.remove();
  wakeListener = null;
  onWakeCb = null;
  ready = false;
  listening = false;
}
