import { requireNativeModule } from "expo-modules-core";

export interface WakeEvent {
  /** Raw BPE token string from sherpa-onnx (e.g. "J A R V I S"). */
  keyword: string;
}

export interface SherpaWakeModule {
  /** Load the zipformer-gigaspeech KWS model from Android assets. Idempotent.
   *  Returns false if AssetManager is null or the model fails to construct. */
  init(): Promise<boolean>;
  /** Start background AudioRecord + KWS loop. No-op if already running. */
  start(): Promise<boolean>;
  /** Stop the KWS loop and release the AudioRecord (keeps the model loaded). */
  stop(): Promise<boolean>;
  /** Fully release the model and audio resources. */
  destroy(): Promise<boolean>;
  /** Subscribe to a native event. Currently only "wake" is emitted. */
  addListener(
    eventName: "wake",
    listener: (event: WakeEvent) => void,
  ): { remove: () => void };
}

/** The native module instance, typed. Resolves to the `SherpaWake` module
 *  declared in `expo-module.config.json` + `SherpaWakeModule.kt`. */
export default requireNativeModule<SherpaWakeModule>("SherpaWake");
