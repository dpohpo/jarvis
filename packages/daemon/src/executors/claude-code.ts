/**
 * Claude Code headless executor.
 *
 * Spawns `claude -p <prompt> --output-format stream-json` and translates the
 * NDJSON stream into Jarvis task events. Format verified live (claude_code 2.1.150):
 *   {"type":"system","subtype":"init","session_id":...}
 *   {"type":"assistant","message":{"content":[{"type":"text"|"tool_use",...}]}}
 *   {"type":"result","subtype":"success","result":"..."}
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { TaskEventKind } from "@jarvis/protocol";

export interface ExecutorEvent {
  ev: TaskEventKind;
  data: string;
}

export interface RunOpts {
  prompt: string;
  workdir: string;
  resumeSessionId?: string;
  onEvent: (e: ExecutorEvent) => void;
  onSessionId?: (sessionId: string) => void;
}

const CANDIDATE_BINS = [
  process.env.JARVIS_CLAUDE_BIN,
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
  `${process.env.HOME}/.claude/local/claude`,
].filter((p): p is string => !!p);

export function findClaudeBin(): string {
  for (const p of CANDIDATE_BINS) if (existsSync(p)) return p;
  throw new Error("claude binary not found; set JARVIS_CLAUDE_BIN");
}

export interface RunningTask {
  kill: () => void;
  done: Promise<{ ok: boolean; result: string }>;
}

export function runClaudeCode(opts: RunOpts): RunningTask {
  const bin = findClaudeBin();
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    // The daemon-level approval gate decides what reaches the phone; inside the
    // sandboxed workdir Claude Code runs unattended.
    "--dangerously-skip-permissions",
  ];
  if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);

  const child = spawn(bin, args, {
    cwd: opts.workdir,
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "jarvis-daemon" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let buffer = "";
  let resultText = "";
  let ok = false;

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      handleLine(line);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (text) opts.onEvent({ ev: "progress", data: `[stderr] ${text.slice(0, 500)}` });
  });

  function handleLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = msg.type as string;

    if (type === "system" && msg.subtype === "init") {
      const sid = msg.session_id as string | undefined;
      if (sid) opts.onSessionId?.(sid);
      opts.onEvent({ ev: "started", data: "" });
      return;
    }
    if (type === "assistant") {
      const message = msg.message as { content?: Array<Record<string, unknown>> } | undefined;
      for (const block of message?.content ?? []) {
        if (block.type === "text" && typeof block.text === "string" && block.text) {
          opts.onEvent({ ev: "output", data: block.text });
        } else if (block.type === "tool_use") {
          const name = String(block.name ?? "tool");
          opts.onEvent({ ev: "tool_use", data: name });
        }
      }
      return;
    }
    if (type === "result") {
      ok = msg.subtype === "success";
      resultText = typeof msg.result === "string" ? msg.result : "";
    }
  }

  const done = new Promise<{ ok: boolean; result: string }>((resolve) => {
    child.on("close", (code) => {
      if (ok) {
        opts.onEvent({ ev: "done", data: resultText });
      } else {
        opts.onEvent({ ev: "error", data: resultText || `claude exited with code ${code}` });
      }
      resolve({ ok, result: resultText });
    });
    child.on("error", (err) => {
      opts.onEvent({ ev: "error", data: String(err) });
      resolve({ ok: false, result: String(err) });
    });
  });

  return { kill: () => child.kill("SIGTERM"), done };
}
