/**
 * Codex CLI headless executor (verified against codex-cli 0.139.0).
 *
 * Spawns `codex exec --json [-C <wd>] [--dangerously-bypass-approvals-and-sandbox]
 * [resume <threadId>] <prompt>` and translates the JSONL stream into Jarvis
 * task events.
 *
 * Verified codex 0.139 JSONL schema (captured live):
 *   {"type":"thread.started","thread_id":"<uuid>"}
 *   {"type":"turn.started"}
 *   {"type":"item.started","item":{"id":"item_N","type":"command_execution",
 *                                   "command":"...","status":"in_progress"}}
 *   {"type":"item.completed","item":{"id":"item_N","type":"agent_message",
 *                                     "text":"..."}}
 *   {"type":"item.completed","item":{"id":"item_N","type":"reasoning",
 *                                     "text":"..."}}
 *   {"type":"item.completed","item":{"id":"item_N","type":"command_execution",
 *                                     "command":"...","aggregated_output":"...",
 *                                     "exit_code":0,"status":"completed"}}
 *   {"type":"turn.completed","usage":{"input_tokens":N,"output_tokens":N,
 *                                      "reasoning_output_tokens":N}}
 *
 * Known item.type values: agent_message, reasoning, command_execution,
 * file_change, mcp_tool_call, web_search, todo_list. Unknown types are
 * silently skipped for forward-compat (codex adds new types regularly).
 *
 * Resume: `codex exec resume <threadId> "<prompt>"` — threadId comes from the
 * first turn's thread.started event and persists in ~/.jarvis/workspaces.json.
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
  process.env.JARVIS_CODEX_BIN,
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
  `${process.env.HOME}/.npm-global/bin/codex`,
  `${process.env.HOME}/.local/bin/codex`,
].filter((p): p is string => !!p);

export function findCodexBin(): string | null {
  for (const p of CANDIDATE_BINS) if (existsSync(p)) return p;
  return null;
}

export interface RunningTask {
  kill: () => void;
  done: Promise<{ ok: boolean; result: string }>;
}

interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  path?: string;
  name?: string;
  tool?: string;
  query?: string;
  items?: Array<Record<string, unknown>>;
}

export function runCodex(opts: RunOpts): RunningTask {
  const bin = findCodexBin();
  if (!bin) {
    opts.onEvent({
      ev: "error",
      data: "codex binary not found; run `npm i -g @openai/codex` and `codex login`",
    });
    return {
      kill: () => undefined,
      done: Promise.resolve({
        ok: false,
        result: "codex binary not found",
      }),
    };
  }

  // Build args. codex exec supports a `resume <threadId>` subcommand.
  //   new session:  codex exec --json -C <wd> [flags] "<prompt>"
  //   resume:       codex exec resume <threadId> --json [flags] "<prompt>"
  // NOTE: `codex exec resume` does NOT accept -C/--cd (verified codex 0.139).
  // We set the cwd via the spawn() `cwd` option instead, which works for both.
  const args = ["exec"];
  if (opts.resumeSessionId) {
    args.push("resume", opts.resumeSessionId);
  }
  args.push(
    "--json",
    "--skip-git-repo-check",
    // Daemon is the approval gate; codex itself runs unsandboxed inside the
    // already-approved workspace workdir. Without this flag codex would hang
    // waiting for an interactive approval we never give.
    "--dangerously-bypass-approvals-and-sandbox",
  );
  if (!opts.resumeSessionId && process.env.JARVIS_CODEX_MODEL) {
    // Model override only meaningful for fresh exec; resume inherits.
    args.push("-m", process.env.JARVIS_CODEX_MODEL);
  }
  args.push(opts.prompt);

  // Codex reads auth from ~/.codex/auth.json via $HOME inheritance. Codex
  // also honors CODEX_HOME (defaults to ~/.codex). No env massaging needed.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };

  const child = spawn(bin, args, {
    cwd: opts.workdir,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  let buffer = "";
  let resultText = "";
  let ok = false;
  let startedEmitted = false;

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
    // Filter out the noisy codex_models_manager "failed to refresh available
    // models" error — it's a known cosmetic issue with zhipu/z-ai providers
    // that don't return the OpenAI `{"models":[...]}` envelope; it doesn't
    // affect actual exec.
    const filtered = text
      .split("\n")
      .filter((l) => !l.includes("codex_models_manager") && !l.includes("failed to refresh available models"))
      .join("\n")
      .trim();
    if (filtered) opts.onEvent({ ev: "progress", data: `[stderr] ${filtered.slice(0, 400)}` });
  });

  function handleLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      // Non-JSON banner lines (codex sometimes prints these on first run).
      if (line.length > 0 && line.length < 400) {
        opts.onEvent({ ev: "progress", data: line });
      }
      return;
    }
    const type = String(msg.type ?? "");

    // thread.started carries thread_id — that's our persistent session id.
    if (type === "thread.started") {
      const tid = (msg.thread_id ?? msg.threadId ?? msg.session_id) as string | undefined;
      if (typeof tid === "string" && tid) {
        opts.onSessionId?.(tid);
      }
      if (!startedEmitted) {
        startedEmitted = true;
        opts.onEvent({ ev: "started", data: "" });
      }
      return;
    }

    if (type === "turn.started") {
      if (!startedEmitted) {
        startedEmitted = true;
        opts.onEvent({ ev: "started", data: "" });
      }
      return;
    }

    if (type === "item.started") {
      // Optionally surface command/file ops the moment they begin so the
      // phone sees live activity instead of waiting for completion.
      const item = msg.item as CodexItem | undefined;
      if (item?.type === "command_execution" && item.command) {
        opts.onEvent({ ev: "tool_use", data: `⚙ ${item.command.slice(0, 200)}` });
      }
      return;
    }

    if (type === "item.completed") {
      const item = msg.item as CodexItem | undefined;
      if (!item) return;
      handleItemCompleted(item);
      return;
    }

    if (type === "turn.completed") {
      ok = true;
      // If an agent_message arrived this turn, resultText is already set.
      // Otherwise synthesize a short completion summary from usage.
      if (!resultText) {
        const usage = msg.usage as { output_tokens?: number } | undefined;
        resultText = usage?.output_tokens != null
          ? `(codex 完成，输出 ${usage.output_tokens} tokens)`
          : "codex 完成";
      }
      return;
    }

    if (type === "error" || type === "item.failed") {
      const errMsg = (msg.message ?? msg.error ?? msg.text) as string | undefined;
      resultText = String(errMsg ?? "codex error");
      ok = false;
      return;
    }

    // Unknown top-level type — ignore silently (forward-compat).
  }

  function handleItemCompleted(item: CodexItem): void {
    const t = String(item.type ?? "");
    switch (t) {
      case "agent_message": {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) {
          // The last agent_message of the turn is the natural "result".
          resultText = text;
          opts.onEvent({ ev: "output", data: text });
        }
        return;
      }
      case "reasoning": {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) {
          opts.onEvent({ ev: "progress", data: `💭 ${text.slice(0, 280)}` });
        }
        return;
      }
      case "command_execution": {
        const cmd = typeof item.command === "string" ? item.command : "(cmd)";
        const exit = item.exit_code;
        const okExit = typeof exit === "number" && exit === 0;
        const tail = (typeof item.aggregated_output === "string" && item.aggregated_output)
          ? `\n└─ ${item.aggregated_output.split("\n").slice(-3).join("\n   ").slice(0, 200)}`
          : "";
        opts.onEvent({
          ev: "tool_use",
          data: `${okExit ? "✓" : exit == null ? "…" : "✕"} ⚙ ${cmd.slice(0, 160)}${tail}`,
        });
        return;
      }
      case "file_change":
      case "file.change":
      case "file_edit": {
        const p = item.path ?? item.name ?? "file";
        opts.onEvent({ ev: "tool_use", data: `📝 ${String(p)}` });
        return;
      }
      case "mcp_tool_call":
      case "mcp.tool_call": {
        const tool = item.tool ?? item.name ?? "mcp";
        opts.onEvent({ ev: "tool_use", data: `🔧 ${String(tool)}` });
        return;
      }
      case "web_search":
      case "web.search": {
        const q = item.query ?? "";
        opts.onEvent({ ev: "tool_use", data: `🔍 ${String(q)}` });
        return;
      }
      case "todo_list":
      case "todo.list": {
        const items = item.items;
        if (Array.isArray(items)) {
          const summary = items
            .map((it) => {
              const m = it as Record<string, unknown>;
              const text = String(m.text ?? m.content ?? "");
              const status = String(m.status ?? "");
              const mark = status === "completed" ? "✓" : status === "in_progress" ? "▶" : "○";
              return `${mark} ${text}`.trim();
            })
            .join("\n");
          if (summary) opts.onEvent({ ev: "progress", data: summary });
        }
        return;
      }
      default:
        // Unknown item.type — skip silently.
        return;
    }
  }

  const done = new Promise<{ ok: boolean; result: string }>((resolve) => {
    child.on("close", (code) => {
      if (ok) {
        opts.onEvent({ ev: "done", data: resultText });
      } else {
        opts.onEvent({
          ev: "error",
          data: resultText || `codex exited with code ${code}`,
        });
      }
      resolve({ ok, result: resultText });
    });
    child.on("error", (err) => {
      opts.onEvent({ ev: "error", data: String(err) });
      resolve({ ok: false, result: String(err) });
    });
  });

  const kill = () => {
    if (child.pid == null) return;
    try {
      process.kill(-child.pid, "SIGTERM");
      setTimeout(() => {
        try {
          if (child.pid != null) process.kill(-child.pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }, 3000).unref();
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  };
  return { kill, done };
}
