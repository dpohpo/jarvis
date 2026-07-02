/**
 * Wake-word detection — uses standard RN NativeModules (NOT expo requireNativeModule).
 *
 * SherpaWakeReactModule is a standard ReactContextBaseJavaModule registered
 * via SherpaWakeReactPackage in MainApplication.kt. This bypasses the expo
 * module autolinking chain entirely — no dependency on autolinking.json,
 * ExpoModulesPackageList.kt, or expo-module-gradle-plugin registration.
 */
import { NativeModules, NativeEventEmitter } from "react-native";

const SherpaWake = NativeModules.SherpaWake as {
  init(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  destroy(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
} | undefined;

let wakeListener: { remove: () => void } | null = null;
let onWakeCb: (() => void) | null = null;
let ready = false;
let listening = false;

export function isWakeReady(): boolean {
  return ready;
}

export function isListening(): boolean {
  return listening;
}

export async function initWake(onWake: () => void): Promise<boolean> {
  if (!SherpaWake) {
    console.warn("[wake] NativeModules.SherpaWake not found — wake-word disabled.");
    return false;
  }
  if (ready) {
    onWakeCb = onWake;
    return true;
  }
  onWakeCb = onWake;

  // Subscribe to "wake" event via NativeEventEmitter.
  if (!wakeListener) {
    const emitter = new NativeEventEmitter(SherpaWake as any);
    wakeListener = emitter.addListener("wake", () => {
      onWakeCb?.();
    });
  }

  try {
    ready = await SherpaWake.init();
    if (!ready) console.error("[wake] SherpaWake.init() returned false");
    return ready;
  } catch (e) {
    console.error("[wake] init failed:", String(e));
    ready = false;
    return false;
  }
}

export async function startListening(): Promise<boolean> {
  if (!SherpaWake || !ready || listening) return listening;
  try {
    const ok = await SherpaWake.start();
    listening = ok;
    return ok;
  } catch (e) {
    console.error("[wake] start failed:", String(e));
    return false;
  }
}

export async function pauseListening(): Promise<void> {
  if (!listening || !SherpaWake) {
    listening = false;
    return;
  }
  try {
    await SherpaWake.stop();
  } catch (e) {
    console.error("[wake] stop failed:", String(e));
  }
  listening = false;
}

export async function destroyWake(): Promise<void> {
  if (SherpaWake) {
    try {
      if (listening) await SherpaWake.stop();
      await SherpaWake.destroy();
    } catch (e) {
      console.error("[wake] destroy failed:", String(e));
    }
  }
  wakeListener?.remove();
  wakeListener = null;
  onWakeCb = null;
  ready = false;
  listening = false;
}
