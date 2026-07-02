/**
 * Wake-word detection — sherpa-onnx KWS, lazy-loaded.
 *
 * Native module `sherpa-wake` is an Expo Module wrapping sherpa-onnx
 * KeywordSpotter. The .so libs + onnx model + tokens.txt live under
 * modules/sherpa-wake/android/src/main/{jniLibs,assets}.
 *
 * CRASH FIX (v6.1): the previous top-level `import SherpaWake from
 * "sherpa-wake"` threw "Cannot find native module 'SherpaWake'" because
 * gradle autolinking didn't pick up the pnpm `file:`-linked module —
 * the JS bundle resolved but the native side wasn't registered, so the
 * require threw synchronously at module-eval time, killing the RN
 * runtime before the app could render a single frame.
 *
 * Now: every entry point calls sherpaWakeModule() which lazy-requires
 * and verifies the native side; if missing it returns null and all
 * public functions degrade to safe no-ops with a console warning.
 *
 * When autolinking is properly configured (see v6.2 todo), the same
 * code path activates the real native KWS.
 */

let _sherpaWake: any | null | undefined = undefined;

function sherpaWakeModule(): any | null {
  if (_sherpaWake !== undefined) return _sherpaWake;
  try {
    // require() not import — avoids hoisting, only runs when called.
    const mod = require("sherpa-wake");
    // Expo Modules with no native registration return a proxy whose
    // .init etc. throw when called. Verify at least one method exists.
    if (mod && typeof mod.init === "function") {
      _sherpaWake = mod;
    } else {
      console.warn("[wake] sherpa-wake module loaded but native side not registered. Wake-word disabled.");
      _sherpaWake = null;
    }
  } catch (e) {
    console.warn("[wake] sherpa-wake require failed:", String(e), "Wake-word disabled.");
    _sherpaWake = null;
  }
  return _sherpaWake;
}

let wakeListener: { remove: () => void } | null = null;
let onWakeCb: (() => void) | null = null;
let ready = false;
let listening = false;
let warnedMissing = false;

function warnMissingOnce(): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn("[wake] Native SherpaWake module not available — wake-word calls are no-ops. Rebuild APK with sherpa-wake autolinked to enable.");
}

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
  const SherpaWake = sherpaWakeModule();
  if (!SherpaWake) {
    warnMissingOnce();
    return false;
  }
  if (ready) {
    onWakeCb = onWake;
    return true;
  }
  onWakeCb = onWake;
  if (!wakeListener) {
    wakeListener = SherpaWake.addListener("wake", () => {
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
  const SherpaWake = sherpaWakeModule();
  if (!SherpaWake) {
    warnMissingOnce();
    return false;
  }
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

export async function pauseListening(): Promise<void> {
  if (!listening) return;
  const SherpaWake = sherpaWakeModule();
  if (!SherpaWake) {
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
  const SherpaWake = sherpaWakeModule();
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
