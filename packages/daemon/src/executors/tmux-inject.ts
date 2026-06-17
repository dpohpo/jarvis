/**
 * tmux injection executor — controls a LIVE Claude Code / Codex pane.
 *
 * Strategy:
 *   1. Capture baseline (last 5 lines) as anchor.
 *   2. `tmux send-keys -t <target> "<prompt>" Enter` injects the message.
 *   3. Poll `tmux capture-pane -p -S -200` every 100ms; diff vs last snapshot.
 *   4. New lines → emit as `progress` events (skip the echoed prompt line).
 *   5. 2 seconds of silence → emit `done` with the captured tail as result.
 *   6. Manual `kill()` sends Ctrl-C (`tmux send-keys C-c`) to interrupt.
 *
 * Per-target mutex: only one tmux injection can run against a given pane at a
 * time. A second run against the same target returns an error immediately —
 * the phone UI shows "busy".
 *
 * Limitations:
 *   - No semantic understanding of "agent done" — we rely on the 2s-silence
 *     heuristic. A long-running `npm install` produces continuous output, so
 *     it stays "running" until it actually finishes; that's the right
 *     behavior. A 3-second thinking pause would falsely end the turn, but
 *     that's rare in practice and the phone has a manual "wait more" button.
 *   - Doesn't parse ANSI formatting; capture-pane -p strips most colors.
 */
import { spawn } from "node:child_process";
import type { TaskEventKind } from "@jarvis/protocol";

export interface TmuxExecutorEvent {
  ev: TaskEventKind;
  data: string;
}

export interface TmuxRunOpts {
  /** Full tmux target: "session:window.pane", e.g. "glm-…:1.1". */
  target: string;
  prompt: string;
  onEvent: (e: TmuxExecutorEvent) => void;
  onSessionId?: (sessionId: string) => void;
}

export interface RunningTask {
  kill: () => void;
  done: Promise<{ ok: boolean; result: string }>;
}

const POLL_INTERVAL_MS = 100;
const SILENCE_TIMEOUT_MS = 2000;
const HARD_TIMEOUT_MS = 5 * 60 * 1000;
const CAPTURE_LINES = 200;

// Per-target mutex: targets currently being injected.
const activeTargets = new Set<string>();

function tmux(args: string[], opts: { capture: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tmux", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else if (opts.capture) resolve(stdout || stderr);
      else reject(new Error(`tmux ${args.join(" ")} exited ${code}: ${stderr}`));
    });
    child.on("error", reject);
  });
}

/** Capture the visible pane content as plain text (last N lines). */
async function capturePane(target: string, lines = CAPTURE_LINES): Promise<string[]> {
  const out = await tmux(
    ["capture-pane", "-t", target, "-p", "-S", `-${lines}`, "-E", "-"],
    { capture: true },
  );
  return out.split("\n");
}

function diffLines(before: string[], after: string[]): string[] {
  // Find the longest common suffix of `before` inside `after`; everything after
  // that point in `after` is new content.
  let bi = before.length - 1;
  let ai = after.length - 1;
  while (bi >= 0 && ai >= 0 && before[bi] === after[ai]) {
    bi--;
    ai--;
  }
  return after.slice(ai + 1);
}

function looksLikePromptEcho(line: string, prompt: string): boolean {
  // free-code / claude renders the user input prefixed with a marker like
  // "> " or "❯ ". Strip those before comparing.
  const stripped = line.replace(/^[\s>❯$]+/, "").trim();
  if (!stripped) return false;
  // exact match or prompt-is-prefix-of-line (some TUIs wrap with brackets)
  if (stripped === prompt) return true;
  if (prompt.length > 8 && stripped.includes(prompt.slice(0, Math.min(40, prompt.length)))) {
    return true;
  }
  return false;
}

export function runTmuxInject(opts: TmuxRunOpts): RunningTask {
  const { target, prompt } = opts;

  if (activeTargets.has(target)) {
    opts.onEvent({
      ev: "error",
      data: `pane ${target} 已被另一个 Jarvis 任务占用，请先结束那个任务`,
    });
    return {
      kill: () => undefined,
      done: Promise.resolve({ ok: false, result: "target busy" }),
    };
  }
  activeTargets.add(target);

  let killed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let hardTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSnapshot: string[] = [];
  let collected: string[] = [];
  let resolveDone: ((r: { ok: boolean; result: string }) => void) | null = null;

  const done = new Promise<{ ok: boolean; result: string }>((resolve) => {
    resolveDone = resolve;
  });

  function cleanup(): void {
    if (pollTimer) clearTimeout(pollTimer);
    if (silenceTimer) clearTimeout(silenceTimer);
    if (hardTimer) clearTimeout(hardTimer);
    pollTimer = null;
    silenceTimer = null;
    hardTimer = null;
    activeTargets.delete(target);
  }

  function finish(ok: boolean, result: string): void {
    if (!resolveDone) return;
    cleanup();
    opts.onEvent({ ev: ok ? "done" : "error", data: result });
    resolveDone({ ok, result });
    resolveDone = null;
  }

  // Kick off async — can't await in executor factory, so wrap in IIFE.
  void (async () => {
    try {
      // Verify target exists.
      try {
        await tmux(["display-message", "-t", target, "-p", "#{session_name}"], { capture: true });
      } catch {
        finish(false, `tmux target '${target}' 不存在或不可达`);
        return;
      }

      // Baseline snapshot.
      lastSnapshot = await capturePane(target, 5);

      opts.onEvent({ ev: "started", data: "" });
      opts.onEvent({ ev: "progress", data: `→ ${target} 注入: ${prompt.slice(0, 100)}` });

      // Inject. Escape the prompt for tmux send-keys literal mode.
      // Use `-l` so tmux doesn't reinterpret `{`,`}`,`$` as key-name syntax.
      await tmux(["send-keys", "-t", target, "-l", prompt], { capture: false });
      await tmux(["send-keys", "-t", target, "Enter"], { capture: false });

      // Hard timeout — a turn shouldn't take 5 min unless the agent is stuck.
      hardTimer = setTimeout(() => {
        if (!resolveDone) return;
        opts.onEvent({ ev: "error", data: "5 分钟硬超时，已自动结束" });
        finish(false, "hard timeout");
      }, HARD_TIMEOUT_MS);

      const poll = async () => {
        if (!resolveDone || killed) return;
        try {
          const snap = await capturePane(target);
          const newLines = diffLines(lastSnapshot, snap);
          lastSnapshot = snap;
          if (newLines.length > 0) {
            // Reset silence timer — the pane is still producing.
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
              if (!resolveDone) return;
              const result = collected.join("\n").trim() || "(无输出)";
              finish(true, result);
            }, SILENCE_TIMEOUT_MS);

            for (const line of newLines) {
              if (!line.trim()) continue;
              if (looksLikePromptEcho(line, prompt)) continue;
              collected.push(line);
              opts.onEvent({ ev: "progress", data: line });
            }
          }
        } catch {
          // capture-pane errors are transient (target may have just exited);
          // skip this tick.
        }
        if (resolveDone !== null && !killed) {
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      // First poll after a short delay to let the pane render the echo.
      setTimeout(() => void poll(), 200);
    } catch (err) {
      finish(false, String(err));
    }
  })();

  const kill = () => {
    if (killed) return;
    killed = true;
    // Send Ctrl-C to interrupt whatever the agent is doing.
    void tmux(["send-keys", "-t", target, "C-c"], { capture: true }).finally(() => {
      finish(false, "用户中断");
    });
  };

  return { kill, done };
}
