/**
 * Inject react-native-libsodium (API-compatible with libsodium-wrappers)
 * into the shared protocol package. Must complete before any crypto call.
 */
import sodium from "react-native-libsodium";
import { initCrypto, type SodiumLike } from "@jarvis/protocol";

let ready: Promise<void> | null = null;

export function ensureCrypto(): Promise<void> {
  if (!ready) ready = initCrypto(sodium as unknown as SodiumLike);
  return ready;
}
