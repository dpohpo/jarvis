/**
 * Inner payloads — what devices say to each other AFTER decryption.
 * The relay never sees any of this.
 */
import { z } from "zod";

export const HelloPayload = z.object({
  t: z.literal("hello"),
  seq: z.number().int().nonnegative(),
  resumeFrom: z.number().int().nonnegative().optional(),
  deviceName: z.string().optional(),
});

/** Phone → daemon: a natural-language command. */
export const CmdSubmit = z.object({
  t: z.literal("cmd.submit"),
  seq: z.number().int(),
  cmdId: z.string(),
  text: z.string().min(1),
  workdir: z.string().optional(),
  resumeTaskId: z.string().optional(),
});

export const TaskEventKind = z.enum([
  "started",
  "thinking",
  "output",
  "tool_use",
  "progress",
  "done",
  "error",
]);

/** Daemon → phone: streamed task lifecycle. `output` chunks are batched (~100ms / 2KB). */
export const TaskEvent = z.object({
  t: z.literal("task.event"),
  seq: z.number().int(),
  taskId: z.string(),
  cmdId: z.string().optional(),
  ev: TaskEventKind,
  data: z.string(),
  ts: z.number().int(),
});

export const PermRequest = z.object({
  t: z.literal("perm.request"),
  seq: z.number().int(),
  reqId: z.string(),
  taskId: z.string(),
  tier: z.union([z.literal(2), z.literal(3)]),
  summary: z.string(),
  detail: z.string(),
  timeoutSec: z.number().int().positive(),
  onTimeout: z.literal("deny"),
});

export const PermResponse = z.object({
  t: z.literal("perm.response"),
  seq: z.number().int(),
  reqId: z.string(),
  decision: z.enum(["allow", "deny"]),
  scope: z.enum(["once", "session", "always"]).default("once"),
});

export const TaskListReq = z.object({
  t: z.literal("task.list"),
  seq: z.number().int(),
});

export const TaskSummary = z.object({
  taskId: z.string(),
  status: z.enum(["running", "waiting_approval", "paused", "done", "error"]),
  title: z.string(),
  workdir: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const TaskState = z.object({
  t: z.literal("task.state"),
  seq: z.number().int(),
  tasks: z.array(TaskSummary),
});

export const Ack = z.object({
  t: z.literal("ack"),
  upTo: z.number().int(),
});

/** Pairing: sent as a sealed box to the daemon, NOT as a regular peer message. */
export const PairRequest = z.object({
  t: z.literal("pair.request"),
  token: z.string(),
  deviceName: z.string(),
  boxPub: z.string(), // base64
  signPub: z.string(), // base64
});

export const PairAccept = z.object({
  t: z.literal("pair.accept"),
  daemonName: z.string(),
  deviceId: z.string(),
});

export const Payload = z.discriminatedUnion("t", [
  HelloPayload,
  CmdSubmit,
  TaskEvent,
  PermRequest,
  PermResponse,
  TaskListReq,
  TaskState,
  Ack,
  PairAccept,
]);

export type Payload = z.infer<typeof Payload>;
export type CmdSubmit = z.infer<typeof CmdSubmit>;
export type TaskEvent = z.infer<typeof TaskEvent>;
export type TaskEventKind = z.infer<typeof TaskEventKind>;
export type PermRequest = z.infer<typeof PermRequest>;
export type PermResponse = z.infer<typeof PermResponse>;
export type TaskSummary = z.infer<typeof TaskSummary>;
export type PairRequest = z.infer<typeof PairRequest>;
export type PairAccept = z.infer<typeof PairAccept>;
export type HelloPayload = z.infer<typeof HelloPayload>;
