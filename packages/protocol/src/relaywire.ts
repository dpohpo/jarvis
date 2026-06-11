/**
 * Relay ↔ client wire protocol (NOT end-to-end encrypted — carries no secrets).
 * Auth proves possession of an Ed25519 key so `from` can't be spoofed;
 * actual confidentiality lives entirely in the envelope's box.
 */
import { z } from "zod";
import { Envelope } from "./envelope.js";

/** Server → client, immediately after connect. */
export const WireChallenge = z.object({
  t: z.literal("challenge"),
  nonce: z.string(), // base64, sign exactly this
});

/** Client → server. */
export const WireAuth = z.object({
  t: z.literal("auth"),
  deviceId: z.string().min(1).max(64),
  room: z.string().min(8).max(64),
  signPub: z.string(), // base64 Ed25519 public key
  sig: z.string(), // base64 detached signature over challenge nonce bytes
});

export const WireAuthOk = z.object({
  t: z.literal("auth.ok"),
  queued: z.number().int(),
});

export const WireAuthErr = z.object({
  t: z.literal("auth.err"),
  reason: z.string(),
});

export const WireSend = z.object({
  t: z.literal("send"),
  env: Envelope,
});

export const WireRecv = z.object({
  t: z.literal("recv"),
  env: Envelope,
});

export const WirePresence = z.object({
  t: z.literal("presence"),
  online: z.array(z.string()),
});

export const WireError = z.object({
  t: z.literal("error"),
  reason: z.string(),
});

export const ClientFrame = z.discriminatedUnion("t", [WireAuth, WireSend]);
export const ServerFrame = z.discriminatedUnion("t", [
  WireChallenge,
  WireAuthOk,
  WireAuthErr,
  WireRecv,
  WirePresence,
  WireError,
]);

export type ClientFrame = z.infer<typeof ClientFrame>;
export type ServerFrame = z.infer<typeof ServerFrame>;
