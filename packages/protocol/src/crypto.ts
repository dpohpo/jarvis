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

/**
 * 128-bit random id, hex. Sodium-backed so it works on Hermes too —
 * ulid/uuid libraries die there with "failed to find a reliable PRNG"
 * (no global crypto.getRandomValues).
 */
export function randomId(): string {
  return getSodium().to_hex(getSodium().randombytes_buf(16));
}

export function toB64(data: Uint8Array): string {
  const sodium = getSodium();
  return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

export function fromB64(data: string): Uint8Array {
  const sodium = getSodium();
  return sodium.from_base64(data, sodium.base64_variants.ORIGINAL);
}

// UTF-8 helpers are pure JS on purpose: react-native-libsodium's native runtime
// does NOT implement from_string (its .d.ts claims otherwise), so any sodium
// string helper is a landmine. TextEncoder/TextDecoder exist on Node 20+ and
// Hermes; the manual path covers anything older.
export function utf8ToBytes(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.codePointAt(i)!;
    if (cp > 0xffff) i++; // surrogate pair consumed
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return new Uint8Array(out);
}

export function bytesToUtf8(b: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(b);
  let s = "";
  for (let i = 0; i < b.length; ) {
    const x = b[i]!;
    let cp: number;
    if (x < 0x80) {
      cp = x;
      i += 1;
    } else if (x < 0xe0) {
      cp = ((x & 0x1f) << 6) | (b[i + 1]! & 0x3f);
      i += 2;
    } else if (x < 0xf0) {
      cp = ((x & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f);
      i += 3;
    } else {
      cp =
        ((x & 0x07) << 18) |
        ((b[i + 1]! & 0x3f) << 12) |
        ((b[i + 2]! & 0x3f) << 6) |
        (b[i + 3]! & 0x3f);
      i += 4;
    }
    s += String.fromCodePoint(cp);
  }
  return s;
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
