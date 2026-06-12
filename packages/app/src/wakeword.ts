/**
 * Wake-word detection ("Jarvis") via Picovoice Porcupine.
 *
 * Porcupine uses the BuiltInKeyword.JARVIS model (verified present in the
 * package enum — no training, no .ppn file needed). It needs a free AccessKey
 * from console.picovoice.ai, which the daemon pushes down (config payload) so
 * the secret stays on the Mac.
 *
 * IMPORTANT mic coordination: Porcupine and our push-to-talk capture
 * (voice.ts) both drive the SAME react-native-voice-processor singleton, so
 * only one may hold the mic at a time. On wake we stop Porcupine (releases the
 * mic), let the caller run a normal recording, then resume listening.
 */
import {
  PorcupineManager,
  BuiltInKeyword,
} from "@picovoice/porcupine-react-native";

let manager: PorcupineManager | null = null;
let listening = false;
let onWakeCb: (() => void) | null = null;

/** True once a manager exists (i.e. an AccessKey was provided and init succeeded). */
export function isWakeReady(): boolean {
  return manager !== null;
}

export function isListening(): boolean {
  return listening;
}

/**
 * Build the Porcupine manager for the "Jarvis" keyword. Idempotent-ish:
 * tears down any previous instance first. Returns false on bad/empty key.
 */
export async function initWake(accessKey: string, onWake: () => void): Promise<boolean> {
  if (!accessKey) return false;
  await destroyWake();
  onWakeCb = onWake;
  try {
    manager = await PorcupineManager.fromBuiltInKeywords(
      accessKey,
      [BuiltInKeyword.JARVIS],
      (_keywordIndex: number) => {
        // mic is about to be needed by the recorder — release it first
        void pauseListening().then(() => onWakeCb?.());
      },
      (err: unknown) => {
        console.error("[wake] porcupine error:", String(err));
      },
    );
    return true;
  } catch (e) {
    console.error("[wake] init failed:", String(e));
    manager = null;
    return false;
  }
}

/** Start listening for "Jarvis". No-op if not initialised. */
export async function startListening(): Promise<boolean> {
  if (!manager || listening) return listening;
  try {
    await manager.start();
    listening = true;
    return true;
  } catch (e) {
    console.error("[wake] start failed:", String(e));
    return false;
  }
}

/** Stop listening but keep the manager (so we can resume after a recording). */
export async function pauseListening(): Promise<void> {
  if (!manager || !listening) return;
  try {
    await manager.stop();
  } catch (e) {
    console.error("[wake] stop failed:", String(e));
  }
  listening = false;
}

/** Fully release Porcupine (and its mic). Call when turning the feature off. */
export async function destroyWake(): Promise<void> {
  if (!manager) return;
  try {
    if (listening) await manager.stop();
    await manager.delete();
  } catch (e) {
    console.error("[wake] destroy failed:", String(e));
  }
  manager = null;
  listening = false;
}
