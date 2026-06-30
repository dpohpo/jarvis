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

/**
 * Resolve how to invoke Claude Code.
 *
 * Returns `{ bin, preArgs }` so the caller does `spawn(bin, [...preArgs, ...userArgs])`.
 *
 * Why this exists: the homebrew/npm `@anthropic-ai/claude-code` package ships a
 * standalone Mach-O binary at `bin/claude.exe` (no cli.js). On macOS Sequoia
 * (15.x) this binary is **unsigned**, and the OS marks it with the
 * `com.apple.provenance` xattr on every install/upgrade. Sequoia then SIGKILLs
 * it on exec (exit 137, no stderr) — so `spawn("/opt/homebrew/bin/claude")`
 * produces zero output and the task appears to hang on the phone.
 *
 * Workaround: prefer invoking via `node <cli.js>` when a cli.js exists anywhere
 * on disk. The user's `~/.claude-cli-local` (populated by their zsh `_claude_exec`)
 * is the canonical source; `JARVIS_CLAUDE_CLI_JS` lets operators override.
 *
 * Verified 2026-06-29: `node cli.js --version` → `2.1.89 (Claude Code)`,
 * while `claude.exe --version` exits 137 with no output.
 */
export function findClaudeEntry(): { bin: string; preArgs: string[] } {
  const cliJs =
    process.env.JARVIS_CLAUDE_CLI_JS ??
    `${process.env.HOME}/.claude-cli-local/node_modules/@anthropic-ai/claude-code/cli.js`;
  if (existsSync(cliJs)) {
    const nodeBin =
      process.env.NODE_BIN ??
      (existsSync("/opt/homebrew/bin/node") ? "/opt/homebrew/bin/node" : "/usr/local/bin/node");
    if (existsSync(nodeBin)) {
      return { bin: nodeBin, preArgs: [cliJs] };
    }
  }
  // Fall back to the standalone binary path (works on Intel Macs, older macOS,
  // or when the binary is properly signed / quarantined-xattr removed).
  return { bin: findClaudeBin(), preArgs: [] };
}

export interface RunningTask {
  kill: () => void;
  done: Promise<{ ok: boolean; result: string }>;
}

export function runClaudeCode(opts: RunOpts): RunningTask {
  const { bin, preArgs } = findClaudeEntry();
  const args = [
    ...preArgs,
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

  // Claude Code talks to the same GLM endpoint as the brain router (via the
  // Anthropic-compatible facade on open.bigmodel.cn). When the daemon is
  // launched from a shell that didn't `export ANTHROPIC_*`, the spawned
  // `claude -p` child inherits no credentials and the API replies 401
  // ("令牌已过期或验证不正确"). Fall back to the Zhipu key that the brain
  // router already uses (ZHIPU_API_KEY / JARVIS_ZHIPU_KEY) and to the verified
  // bigmodel facade URL when the operator hasn't set them explicitly.
  const anthropicApiKey =
    process.env.ANTHROPIC_API_KEY ??
    process.env.ANTHROPIC_AUTH_TOKEN ??
    process.env.ZHIPU_API_KEY ??
    process.env.JARVIS_ZHIPU_KEY;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CODE_ENTRYPOINT: "jarvis-daemon",
  };
  if (anthropicApiKey) {
    childEnv.ANTHROPIC_API_KEY = anthropicApiKey;
    // Some Claude Code builds prefer AUTH_TOKEN over API_KEY; set both so the
    // child can't fall through to "no credentials" again.
    if (!childEnv.ANTHROPIC_AUTH_TOKEN) {
      childEnv.ANTHROPIC_AUTH_TOKEN = anthropicApiKey;
    }
  }
  if (!childEnv.ANTHROPIC_BASE_URL) {
    childEnv.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
  }

  const child = spawn(bin, args, {
    cwd: opts.workdir,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    // own process group so we can kill the whole tree (claude + its Bash/tool
    // children); killing just the leader leaves shell subprocesses orphaned.
    detached: true,
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
          // Surface the actual command/file/pattern so the phone shows what
          // Claude is doing (Bash command, Read file_path, Grep pattern…),
          // not just the tool name.
          const name = String(block.name ?? "tool");
          const input = block.input as Record<string, unknown> | undefined;
          let detail = name;
          if (input) {
            const focus =
              input.command ??
              input.file_path ??
              input.path ??
              input.pattern ??
              input.url ??
              input.prompt ??
              input.query;
            if (typeof focus === "string" && focus) {
              detail = `${name}: ${focus.length > 240 ? focus.slice(0, 240) + "…" : focus}`;
            } else {
              const json = JSON.stringify(input);
              detail = `${name}: ${json.length > 240 ? json.slice(0, 240) + "…" : json}`;
            }
          }
          opts.onEvent({ ev: "tool_use", data: detail });
        } else if (block.type === "tool_result") {
          // tool_result blocks live in user-role messages but Claude Code's
          // stream-json sometimes surfaces them on assistant turns too — emit
          // a compact summary so the phone sees what the tool returned.
          const content = block.content;
          if (typeof content === "string" && content) {
            opts.onEvent({
              ev: "progress",
              data: `↳ ${content.length > 200 ? content.slice(0, 200) + "…" : content}`,
            });
          }
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

  const kill = () => {
    if (child.pid == null) return;
    try {
      // negative pid = signal the whole process group (detached above)
      process.kill(-child.pid, "SIGTERM");
      // escalate if it doesn't exit promptly
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
