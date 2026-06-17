/**
 * tmux pane discovery — finds panes running Claude Code / Codex / free-code.
 *
 * Used by the phone UI to populate the "tmux target picker" when the user
 * switches a workspace into tmux-injection mode.
 *
 * Algorithm:
 *   1. `tmux list-panes -a -F <fmt>` walks every pane across every session.
 *   2. For each pane's pid, walk the process tree up looking for a known
 *      agent binary (claude / free-code / codex).
 *   3. Classify the pane's engine based on the matched binary.
 *
 * No external deps. Uses `ps` for the process walk (cross-platform-safe on
 * macOS; on Linux the same `ps -o command=` syntax works).
 */
import { spawn } from "node:child_process";
import type { TmuxPaneInfo, WorkspaceEngine } from "@jarvis/protocol";

interface RawPane {
  target: string;
  pid: number;
  cmd: string;
  cwd: string;
}

function sh(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (err += c.toString("utf8")));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(" ")} exit ${code}: ${err}`));
    });
    child.on("error", reject);
  });
}

async function listAllPanes(): Promise<RawPane[]> {
  let raw: string;
  try {
    raw = await sh("tmux", [
      "list-panes",
      "-a",
      "-F",
      "#{session_name}:#{window_index}.#{pane_index}\u0001#{pane_pid}\u0001#{pane_current_command}\u0001#{pane_current_path}",
    ]);
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [target, pidStr, cmd, cwd] = line.split("\u0001");
      return {
        target: target ?? "",
        pid: Number(pidStr ?? 0),
        cmd: cmd ?? "",
        cwd: cwd ?? "",
      };
    })
    .filter((p) => p.target && p.pid > 0);
}

/**
 * Walk the process tree starting from `pid` looking for an agent binary.
 * Returns the engine classification or null.
 *
 * We cap the walk depth at 8 to bound cost. ps output is cached per-call.
 */
async function classifyPane(pid: number): Promise<WorkspaceEngine | "unknown"> {
  // Build full ancestor chain via `ps -o pid,ppid,command` on the whole user
  // tree (one ps invocation; cheaper than per-process walks).
  let psOut: string;
  try {
    psOut = await sh("ps", ["-o", "pid,ppid,command", "-ax"]);
  } catch {
    return "unknown";
  }

  // Build pid → {ppid, command} map.
  const procs = new Map<number, { ppid: number; command: string }>();
  for (const line of psOut.split("\n").slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // ps -o pid,ppid,command: numbers-then-numbers-then-rest
    const m = trimmed.match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    procs.set(Number(m[1]), { ppid: Number(m[2]), command: m[3] ?? "" });
  }

  // Walk up the tree from pane_pid.
  let cur = pid;
  for (let i = 0; i < 12 && cur > 1; i++) {
    const info = procs.get(cur);
    if (!info) break;
    const cmd = info.command.toLowerCase();
    // Order matters: free-code wraps claude, so check it before bare claude.
    if (cmd.includes("free-code") || cmd.includes("free_code")) return "claude";
    if (cmd.includes("/claude") || cmd.includes(" claude ") || cmd.endsWith(" claude")) {
      return "claude";
    }
    if (cmd.includes("/codex") || cmd.includes(" codex ") || cmd.endsWith(" codex")) {
      return "codex";
    }
    cur = info.ppid;
  }
  return "unknown";
}

/**
 * Discover all tmux panes that look like an agent pane.
 * Includes unknown panes too — the user may want to manually bind any pane.
 */
export async function detectTmuxPanes(): Promise<TmuxPaneInfo[]> {
  const panes = await listAllPanes();
  if (panes.length === 0) return [];

  const results = await Promise.all(
    panes.map(async (p): Promise<TmuxPaneInfo> => {
      const engine = await classifyPane(p.pid);
      return {
        target: p.target,
        engine,
        cwd: p.cwd,
        cmd: p.cmd,
        pid: p.pid,
      };
    }),
  );

  // Sort: claude first, then codex, then unknown — so the picker's default
  // suggestion is the most likely target.
  const order: Record<WorkspaceEngine | "unknown", number> = {
    claude: 0,
    codex: 1,
    unknown: 2,
  };
  results.sort((a, b) => {
    const oe = order[a.engine] - order[b.engine];
    if (oe !== 0) return oe;
    return a.target.localeCompare(b.target);
  });
  return results;
}

/** True if tmux server is reachable at all. */
export async function tmuxAvailable(): Promise<boolean> {
  try {
    await sh("tmux", ["list-sessions"]);
    return true;
  } catch {
    return false;
  }
}
