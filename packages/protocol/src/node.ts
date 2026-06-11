/**
 * Node entry: "@jarvis/protocol/node".
 * Auto-loads libsodium-wrappers (CJS build — its ESM dist is broken: the .mjs
 * imports ./libsodium.mjs which lives in the sibling `libsodium` package).
 * React Native uses the root entry + initCrypto(react-native-libsodium) instead.
 */
import { createRequire } from "node:module";
import { initCrypto, type SodiumLike } from "./sodium-provider.js";

export * from "./index.js";

export async function cryptoReady(): Promise<void> {
  const sodium = createRequire(import.meta.url)("libsodium-wrappers") as SodiumLike;
  await initCrypto(sodium);
}
