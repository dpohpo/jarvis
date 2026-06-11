/**
 * Sodium implementation injection point.
 *
 * Node consumers import "@jarvis/protocol/node", which auto-loads the
 * libsodium-wrappers CJS build. React Native calls `initCrypto(sodium)` with
 * react-native-libsodium (same API surface) before using anything else —
 * Metro can't bundle node:module, so the Node loader lives in a separate entry.
 */
export interface SodiumLike {
  ready: Promise<void>;
  crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_sign_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_easy(
    m: Uint8Array,
    n: Uint8Array,
    pk: Uint8Array,
    sk: Uint8Array,
  ): Uint8Array;
  crypto_box_open_easy(
    c: Uint8Array,
    n: Uint8Array,
    pk: Uint8Array,
    sk: Uint8Array,
  ): Uint8Array;
  crypto_box_seal(m: Uint8Array, pk: Uint8Array): Uint8Array;
  crypto_box_seal_open(c: Uint8Array, pk: Uint8Array, sk: Uint8Array): Uint8Array;
  crypto_sign_detached(m: Uint8Array, sk: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(sig: Uint8Array, m: Uint8Array, pk: Uint8Array): boolean;
  crypto_generichash(outLen: number, m: Uint8Array): Uint8Array;
  randombytes_buf(n: number): Uint8Array;
  crypto_box_NONCEBYTES: number;
  from_base64(s: string, variant?: number): Uint8Array;
  to_base64(b: Uint8Array, variant?: number): string;
  from_string(s: string): Uint8Array;
  to_string(b: Uint8Array): string;
  to_hex(b: Uint8Array): string;
  base64_variants: { ORIGINAL: number };
}

let impl: SodiumLike | null = null;

/** Inject and initialize a sodium implementation. Idempotent. */
export async function initCrypto(sodium: SodiumLike): Promise<void> {
  await sodium.ready;
  impl = sodium;
}

export function getSodium(): SodiumLike {
  if (!impl) {
    throw new Error(
      "sodium not initialized — import '@jarvis/protocol/node' and call cryptoReady(), or call initCrypto(impl) on React Native",
    );
  }
  return impl;
}
