/**
 * Crypto layer for Jarvis, backed by libsodium.
 *
 * - Long-term identity per device: X25519 box keypair (encryption) + Ed25519 sign keypair (relay auth).
 * - Peer messages: crypto_box_easy (X25519 + XSalsa20-Poly1305), random 24-byte nonce per message.
 * - Pairing bootstrap: sealed box to the daemon's public key (sender anonymous until inner payload is read).
 *
 * The same `libsodium-wrappers` API surface is implemented by `react-native-libsodium`,
 * so this module is shared verbatim by the phone app.
 */
// libsodium-wrappers' ESM dist is broken (its .mjs imports ./libsodium.mjs, which
// lives in the sibling `libsodium` package) — load the CJS build, which resolves
// correctly. The React Native app swaps this module for react-native-libsodium.
import { createRequire } from "node:module";
const _sodium = createRequire(import.meta.url)(
  "libsodium-wrappers",
) as typeof import("libsodium-wrappers");

export interface BoxKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface DeviceIdentity {
  box: BoxKeyPair;
  sign: SignKeyPair;
}

let sodium: typeof _sodium;

/** Must be awaited once before any other function in this module. */
export async function cryptoReady(): Promise<void> {
  await _sodium.ready;
  sodium = _sodium;
}

export function generateIdentity(): DeviceIdentity {
  const box = sodium.crypto_box_keypair();
  const sign = sodium.crypto_sign_keypair();
  return {
    box: { publicKey: box.publicKey, privateKey: box.privateKey },
    sign: { publicKey: sign.publicKey, privateKey: sign.privateKey },
  };
}

export function randomBytes(n: number): Uint8Array {
  return sodium.randombytes_buf(n);
}

export function toB64(data: Uint8Array): string {
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

export function fromB64(data: string): Uint8Array {
  return sodium.from_base64(data, sodium.base64_variants.ORIGINAL);
}

export function utf8ToBytes(s: string): Uint8Array {
  return sodium.from_string(s);
}

export function bytesToUtf8(b: Uint8Array): string {
  return sodium.to_string(b);
}

/** Room id = first 16 bytes of BLAKE2b(roomSecret), hex. Unguessable, reveals nothing. */
export function deriveRoomId(roomSecret: Uint8Array): string {
  const h = sodium.crypto_generichash(32, roomSecret);
  return sodium.to_hex(h.subarray(0, 16));
}

export interface SealedMessage {
  nonce: string; // base64
  box: string; // base64
}

/** Authenticated encryption between two paired devices. */
export function boxTo(
  plaintext: Uint8Array,
  theirBoxPublic: Uint8Array,
  myBoxPrivate: Uint8Array,
): SealedMessage {
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const box = sodium.crypto_box_easy(plaintext, nonce, theirBoxPublic, myBoxPrivate);
  return { nonce: toB64(nonce), box: toB64(box) };
}

/** Returns null on authentication failure instead of throwing, so callers can drop garbage quietly. */
export function boxOpen(
  msg: SealedMessage,
  theirBoxPublic: Uint8Array,
  myBoxPrivate: Uint8Array,
): Uint8Array | null {
  try {
    return sodium.crypto_box_open_easy(
      fromB64(msg.box),
      fromB64(msg.nonce),
      theirBoxPublic,
      myBoxPrivate,
    );
  } catch {
    return null;
  }
}

/** Anonymous sealed box — used once during pairing, phone → daemon. */
export function seal(plaintext: Uint8Array, theirBoxPublic: Uint8Array): string {
  return toB64(sodium.crypto_box_seal(plaintext, theirBoxPublic));
}

export function sealOpen(
  sealedB64: string,
  myBoxPublic: Uint8Array,
  myBoxPrivate: Uint8Array,
): Uint8Array | null {
  try {
    return sodium.crypto_box_seal_open(fromB64(sealedB64), myBoxPublic, myBoxPrivate);
  } catch {
    return null;
  }
}

/** Relay auth: sign the relay's challenge to bind deviceId ↔ sign pubkey. */
export function signDetached(message: Uint8Array, signPrivate: Uint8Array): string {
  return toB64(sodium.crypto_sign_detached(message, signPrivate));
}

export function verifyDetached(
  sigB64: string,
  message: Uint8Array,
  signPublic: Uint8Array,
): boolean {
  try {
    return sodium.crypto_sign_verify_detached(fromB64(sigB64), message, signPublic);
  } catch {
    return false;
  }
}
