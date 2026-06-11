/**
 * Crypto layer for Jarvis, backed by libsodium (implementation injected — see
 * sodium-provider.ts; Node auto-loads via "@jarvis/protocol/node", React Native
 * injects react-native-libsodium).
 *
 * - Long-term identity per device: X25519 box keypair (encryption) + Ed25519 sign keypair (relay auth).
 * - Peer messages: crypto_box_easy (X25519 + XSalsa20-Poly1305), random 24-byte nonce per message.
 * - Pairing bootstrap: sealed box to the daemon's public key.
 */
import { getSodium } from "./sodium-provider.js";

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

export function generateIdentity(): DeviceIdentity {
  const sodium = getSodium();
  const box = sodium.crypto_box_keypair();
  const sign = sodium.crypto_sign_keypair();
  return {
    box: { publicKey: box.publicKey, privateKey: box.privateKey },
    sign: { publicKey: sign.publicKey, privateKey: sign.privateKey },
  };
}

export function randomBytes(n: number): Uint8Array {
  return getSodium().randombytes_buf(n);
}

export function toB64(data: Uint8Array): string {
  const sodium = getSodium();
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

export function fromB64(data: string): Uint8Array {
  const sodium = getSodium();
  return sodium.from_base64(data, sodium.base64_variants.ORIGINAL);
}

export function utf8ToBytes(s: string): Uint8Array {
  return getSodium().from_string(s);
}

export function bytesToUtf8(b: Uint8Array): string {
  return getSodium().to_string(b);
}

/** Room id = first 16 bytes of BLAKE2b(roomSecret), hex. Unguessable, reveals nothing. */
export function deriveRoomId(roomSecret: Uint8Array): string {
  const sodium = getSodium();
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
  const sodium = getSodium();
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
    return getSodium().crypto_box_open_easy(
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
  return toB64(getSodium().crypto_box_seal(plaintext, theirBoxPublic));
}

export function sealOpen(
  sealedB64: string,
  myBoxPublic: Uint8Array,
  myBoxPrivate: Uint8Array,
): Uint8Array | null {
  try {
    return getSodium().crypto_box_seal_open(fromB64(sealedB64), myBoxPublic, myBoxPrivate);
  } catch {
    return null;
  }
}

/** Relay auth: sign the relay's challenge to bind deviceId ↔ sign pubkey. */
export function signDetached(message: Uint8Array, signPrivate: Uint8Array): string {
  return toB64(getSodium().crypto_sign_detached(message, signPrivate));
}

export function verifyDetached(
  sigB64: string,
  message: Uint8Array,
  signPublic: Uint8Array,
): boolean {
  try {
    return getSodium().crypto_sign_verify_detached(fromB64(sigB64), message, signPublic);
  } catch {
    return false;
  }
}
