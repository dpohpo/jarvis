/**
 * Outer envelope — the ONLY thing the relay can see.
 * Routing metadata + an opaque encrypted blob. No plaintext payload ever crosses this boundary.
 */
import { z } from "zod";
import {
  boxOpen,
  boxTo,
  bytesToUtf8,
  randomId,
  utf8ToBytes,
  type SealedMessage,
} from "./crypto.js";
import { Payload } from "./payloads.js";

export const Envelope = z.object({
  v: z.literal(1),
  id: z.string(),
  room: z.string(),
  from: z.string(),
  to: z.string(), // deviceId or "*"
  kind: z.enum(["msg", "voice", "presence", "pair"]),
  nonce: z.string(),
  box: z.string(),
});
export type Envelope = z.infer<typeof Envelope>;

export interface PeerCrypto {
  theirBoxPublic: Uint8Array;
  myBoxPrivate: Uint8Array;
}

export function sealPayload(
  payload: Payload,
  opts: {
    room: string;
    from: string;
    to: string;
    kind?: Envelope["kind"];
    peer: PeerCrypto;
  },
): Envelope {
  const sealed = boxTo(
    utf8ToBytes(JSON.stringify(payload)),
    opts.peer.theirBoxPublic,
    opts.peer.myBoxPrivate,
  );
  return {
    v: 1,
    id: randomId(),
    room: opts.room,
    from: opts.from,
    to: opts.to,
    kind: opts.kind ?? "msg",
    nonce: sealed.nonce,
    box: sealed.box,
  };
}

/**
 * Decrypt + validate an incoming envelope. Returns null on any failure
 * (bad crypto, unknown schema) — callers drop it and move on.
 */
export function openPayload(env: Envelope, peer: PeerCrypto): Payload | null {
  const sealed: SealedMessage = { nonce: env.nonce, box: env.box };
  const plain = boxOpen(sealed, peer.theirBoxPublic, peer.myBoxPrivate);
  if (!plain) return null;
  try {
    const parsed = Payload.safeParse(JSON.parse(bytesToUtf8(plain)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Raw sealed-box envelope used only for pairing (sender has no shared keys yet). */
export function pairEnvelope(room: string, from: string, to: string, sealedB64: string): Envelope {
  return {
    v: 1,
    id: randomId(),
    room,
    from,
    to,
    kind: "pair",
    nonce: "",
    box: sealedB64,
  };
}
