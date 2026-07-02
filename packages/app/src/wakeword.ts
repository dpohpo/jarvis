/**
 * Wake-word detection — STUB (Phase 2).
 *
 * The main branch still has the old Picovoice Porcupine implementation,
 * which depended on `@picovoice/porcupine-react-native` (a native module
 * that needed an AccessKey from console.picovoice.ai that never arrived).
 *
 * Phase 14 will port the sherpa-wake version from the
 * feature/paseo-pixel-perfect branch (Expo Module wrapping
 * sherpa-onnx KeywordSpotter, account-free, runs offline, model bundled
 * under android/app/src/main/assets/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/).
 *
 * For now: keep the public surface so App.tsx imports don't break, but
 * every function is a no-op that logs once. App.tsx in this Phase doesn't
 * use wakeword anyway (no `import { initWake } from "./src/wakeword"`).
 */

let warned = false;
function warnOnce(): void {
  if (!warned) {
    warned = true;
    console.warn(
      "[wake] STUB: wakeword.ts is a no-op on v2-from-scratch until Phase 14 " +
        "(sherpa-wake port).",
    );
  }
}

export function isWakeReady(): boolean {
  return false;
}

export function isListening(): boolean {
  return false;
}

export async function initWake(_accessKey: string, _onWake: () => void): Promise<boolean> {
  warnOnce();
  return false;
}

export async function startListening(): Promise<boolean> {
  warnOnce();
  return false;
}

export async function pauseListening(): Promise<void> {
  // no-op
}

export async function destroyWake(): Promise<void> {
  // no-op
}
