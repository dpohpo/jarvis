import { requireNativeModule } from "expo-modules-core";

export interface WakeEvent {
  /** Raw BPE token string from sherpa-onnx (e.g. "J A R V I S"). */
  keyword: string;
}

export interface SherpaWakeModule {
  init(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  destroy(): Promise<boolean>;
  addListener(
    eventName: "wake",
    listener: (event: WakeEvent) => void,
  ): { remove: () => void };
}

/**
 * Lazy-loaded native module instance. Plain `requireNativeModule(...)`
 * throws synchronously at module-eval time if the native side isn't
 * registered (e.g. gradle autolinking didn't pick up the pnpm `file:`-
 * linked Expo Module). Wrapping in try/catch lets callers handle the
 * absence gracefully instead of killing the RN runtime before the first
 * frame renders.
 *
 * Returns null when native side is missing — wakeword.ts treats that as
 * "wake-word disabled".
 */
let _mod: SherpaWakeModule | null | undefined;
function getSherpaWake(): SherpaWakeModule | null {
  if (_mod !== undefined) return _mod;
  try {
    _mod = requireNativeModule<SherpaWakeModule>("SherpaWake");
  } catch {
    console.warn("[sherpa-wake] Native module not registered — wake-word disabled.");
    _mod = null;
  }
  return _mod;
}

// Export a proxy so existing `import SherpaWake from "sherpa-wake"` keeps
// working, but every property access goes through getSherpaWake() lazily.
// When native module is missing, property access returns undefined (which
// wakeword.ts detects via typeof check before calling).
const SherpaWake = new Proxy(
  {},
  {
    get(_target, prop) {
      const m = getSherpaWake();
      return m ? (m as any)[prop] : undefined;
    },
  },
);

export default SherpaWake;
