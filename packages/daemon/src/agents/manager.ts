/**
 * Agent manager — orchestrates spawn / resume / kill for each agent.
 *
 * Concurrency: UNLIMITED (per user spec). Each agent gets its own spawn.
 * Background behavior: agent processes keep running when user "switches"
 * away — daemon buffers events to tasks.sqlite events table (existing).
 *
 * Resume semantics:
 *   - First message: spawn fresh `claude -p "<prompt>"` → grab session_id
 *   - Subsequent: spawn `claude -p "<text>" --resume <session_id>`
 *   - Codex equivalent: `codex exec --json` / `codex exec resume <threadId>`
 */
import { ulid } from "ulid";
import { join } from "node:path";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import type { Payload } from "@jarvis/protocol";
import {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
  type AgentRecord,
} from "./store.js";
import {
  startAgentTmux,
  sendKeys,
  killAgentTmux,
  isAgentTmuxAlive,
  stopPoller,
  sendSpecialKey,
  reattachPoller,
} from "./tmux_runner.js";
import { runClaudeCode } from "../executors/claude-code.js";
import { runCodex } from "../executors/codex.js";
import { TaskStore } from "../tasks/store.js";

// Per-agent running spawn handle, so we can stop.
interface ActiveSpawn {
  agentId: string;
  kill: () => void;
  done: Promise<{ ok: boolean; result: string }>;
}

const activeSpawns = new Map<string, ActiveSpawn>();

export interface ManagerDeps {
  taskStore: TaskStore;
  /** Resolve a workspace name to an absolute cwd. */
  resolveCwd: (workspace: string) => string;
  /** Push a payload to all interested devices. */
  broadcast: (make: () => Payload) => void;
  /** Push a payload to a specific device. */
  sendTo: (to: string, make: () => Payload) => void;
  /** Daemon log function. */
  log: (msg: string) => void;
}

/** Execution backends. */
export type ExecBackend = "tmux" | "spawn";

export function createAgentManager(deps: ManagerDeps) {
  /**
   * Spawn (or resume) the executor for an agent.
   * Backend "tmux" → tmux session with interactive TUI (user can attach)
   * Backend "spawn" → headless `-p` (legacy, structured stream-json events)
   */
  function spawn(
    agentId: string,
    text: string,
    from: string,
    backend: ExecBackend = "tmux",
  ): { ok: boolean; reason?: string } {
    const agent = getAgent(agentId);
    if (!agent) return { ok: false, reason: "agent not found" };

    // tmux backend: each agent = one tmux session. Subsequent messages go via
    // send-keys (no new spawn). spawn backend keeps the old "fresh spawn per
    // message" model.
    if (backend === "tmux") {
      if (isAgentTmuxAlive(agentId)) {
        // Session already exists → inject message into live TUI.
        const ok = sendKeys(agentId, text);
        if (ok) {
          updateAgent(agentId, {
            status: "running",
            message_count: agent.message_count + 1,
          });
          deps.log(`agent ${agentId} tmux send-keys: ${text.slice(0, 60)}`);
        }
        return { ok, reason: ok ? undefined : "send-keys failed" };
      }
      // No live session → start a new one running claude/codex in TUI mode.
      const taskId = `${agentId}#${ulid()}`;
      deps.taskStore.create(taskId, `[${agent.title}] ${text.slice(0, 80)}`, agent.cwd);
      deps.taskStore.setAgentSession(taskId, agent.session_id ?? "");
      deps.taskStore.setStatus(taskId, "running");
      deps.taskStore.addEvent(taskId, "started", "");

      deps.broadcast(() => ({
        t: "task.event",
        seq: 0,
        taskId,
        cmdId: agentId,
        ev: "started" as never,
        data: "",
        ts: Date.now(),
      } as Payload & { t: "task.event" }));

      const ok = startAgentTmux({
        agentId,
        cwd: agent.cwd,
        engine: agent.engine,
        firstPrompt: text,
        resumeSessionId: agent.session_id ?? undefined,
        taskStore: deps.taskStore,
        taskId,
        log: deps.log,
        onSessionId: (sid) => {
          // First time we see claude-code write its session jsonl for this
          // agent — persist it so future `--resume <sid>` works even after
          // daemon restart or Mac reboot.
          const cur = getAgent(agentId);
          if (cur && cur.session_id !== sid) {
            updateAgent(agentId, { session_id: sid });
            deps.broadcast(() => ({
              t: "agent.state",
              seq: 0,
              agents: listAgents(),
            } as Payload));
          }
          try {
            deps.taskStore.setAgentSession(taskId, sid);
          } catch {
            /* ignore */
          }
        },
      });

      if (ok) {
        updateAgent(agentId, {
          status: "running",
          message_count: agent.message_count + 1,
        });
      }
      return { ok, reason: ok ? undefined : "tmux start failed" };
    }

    // Legacy spawn backend (headless -p, stream-json).
    if (activeSpawns.has(agentId)) {
      return { ok: false, reason: "agent already running" };
    }

    const taskId = `${agentId}#${ulid()}`;
    deps.taskStore.create(taskId, `[${agent.title}] ${text.slice(0, 80)}`, agent.cwd);
    deps.taskStore.setAgentSession(taskId, agent.session_id ?? "");
    deps.taskStore.setStatus(taskId, "running");

    const emit = (ev: Parameters<typeof deps.taskStore.addEvent>[1], data: string) => {
      deps.taskStore.addEvent(taskId, ev, data);
      deps.broadcast(() => ({
        t: "task.event",
        seq: 0,
        taskId,
        cmdId: agentId,
        ev: ev as never,
        data,
        ts: Date.now(),
      } as Payload & { t: "task.event" }));
    };

    emit("started", "");
    updateAgent(agentId, { status: "running", message_count: agent.message_count + 1 });

    const onSessionId = (sid: string) => {
      const cur = getAgent(agentId);
      if (cur && cur.session_id !== sid) {
        updateAgent(agentId, { session_id: sid });
      }
      deps.taskStore.setAgentSession(taskId, sid);
    };

    const isCodex = agent.engine === "codex";
    const spawnOpts = {
      prompt: text,
      workdir: agent.cwd,
      resumeSessionId: agent.session_id ?? undefined,
      onSessionId,
      onEvent: (e: { ev: Parameters<typeof deps.taskStore.addEvent>[1]; data: string }) =>
        emit(e.ev, e.data),
    };

    const task = isCodex ? runCodex(spawnOpts) : runClaudeCode(spawnOpts);
    activeSpawns.set(agentId, {
      agentId,
      kill: task.kill,
      done: task.done,
    });

    void task.done.then(({ ok, result }) => {
      activeSpawns.delete(agentId);
      deps.taskStore.setStatus(taskId, ok ? "done" : "error");
      updateAgent(agentId, { status: ok ? "done" : "error" });
      if (ok) emit("done", result || "(完成)");
      else emit("error", result || "(失败)");
      deps.broadcast(() => ({
        t: "agent.state",
        seq: 0,
        agents: listAgents(),
      } as Payload));
    });

    deps.log(
      `agent ${agentId} spawn ${isCodex ? "codex" : "claude"} resume=${
        agent.session_id?.slice(0, 8) ?? "new"
      } task=${taskId}`,
    );
    return { ok: true };
  }

  function stop(agentId: string): boolean {
    // Try tmux first (kill session).
    if (isAgentTmuxAlive(agentId)) {
      const ok = killAgentTmux(agentId);
      if (ok) {
        updateAgent(agentId, { status: "idle" });
        deps.log(`agent ${agentId} tmux killed by user`);
        return true;
      }
    }
    // Fallback: legacy spawn kill.
    const s = activeSpawns.get(agentId);
    if (s) {
      s.kill();
      activeSpawns.delete(agentId);
      updateAgent(agentId, { status: "idle" });
      deps.log(`agent ${agentId} spawn killed by user`);
      return true;
    }
    return false;
  }

  function isActive(agentId: string): boolean {
    return activeSpawns.has(agentId) || isAgentTmuxAlive(agentId);
  }

  function listActive(): string[] {
    return Array.from(activeSpawns.keys());
  }

  return { spawn, stop, isActive, listActive };
}

/**
 * Reconcile agent state after a daemon restart.
 *
 * Two cases per agent in the DB:
 *   1. status=running + tmux session still alive → reattach a capture-pane
 *      poller so the user sees new output on their phone/desktop. Create a
 *      fresh "reattach" task so events continue to flow under a real task_id.
 *   2. status=running + tmux session gone (e.g. Mac rebooted) → flip status
 *      to "idle" so the UI doesn't lie. The user can still resume the
 *      conversation via `agent.message` if the agent has a session_id (and
 *      we'll spawn a fresh `claude --resume <sid>`).
 *
 * Also performs a one-shot backfill of missing session_ids by scanning the
 * agent's encoded-cwd subdir in ~/.claude/projects/ for the newest jsonl.
 */
export function reconcileAgents(deps: ManagerDeps): void {
  const agents = listAgents();
  let reattached = 0;
  let flipped = 0;
  let backfilled = 0;
  for (const a of agents) {
    // Backfill session_id for agents that never had it captured (e.g. they
    // were started before the capture logic landed).
    if (!a.session_id) {
      const sid = backfillSessionId(a.cwd, a.created_at);
      if (sid) {
        updateAgent(a.id, { session_id: sid });
        backfilled += 1;
        deps.log(`reconcile: backfilled session_id ${sid.slice(0, 8)}… for ${a.id}`);
      }
    }

    if (a.status !== "running") continue;

    if (isAgentTmuxAlive(a.id)) {
      const taskId = `${a.id}#${ulid()}`;
      deps.taskStore.create(taskId, `[reattach] ${a.title}`, a.cwd);
      deps.taskStore.setAgentSession(taskId, a.session_id ?? "");
      deps.taskStore.setStatus(taskId, "running");
      deps.taskStore.addEvent(taskId, "started", "(reattached after daemon restart)");
      reattachPoller({
        agentId: a.id,
        taskId,
        cwd: a.cwd,
        engine: a.engine,
        taskStore: deps.taskStore,
        log: deps.log,
      });
      reattached += 1;
    } else {
      // Tmux session is gone (Mac rebooted, tmux killed, etc.). Mark idle so
      // the UI shows the truth. The user can still resume via agent.message
      // if session_id is known.
      updateAgent(a.id, { status: "idle" });
      flipped += 1;
      deps.log(`reconcile: ${a.id} marked idle (tmux session gone)`);
    }
  }
  deps.log(`reconcile: ${agents.length} agents — reattached=${reattached} flipped=${flipped} backfilled=${backfilled}`);
  if (reattached + flipped + backfilled > 0) {
    deps.broadcast(() => ({ t: "agent.state", seq: 0, agents: listAgents() } as Payload));
  }
}

/**
 * Find the most likely session_id for an agent by looking at the newest
 * jsonl file under ~/.claude/projects/<encoded-cwd>/ that was modified
 * after the agent was created.
 *
 * Heuristic: pick the file with the latest mtime. If multiple agents share
 * the same cwd (rare but possible), this can misattribute — but the user
 * can always delete and recreate.
 */
function backfillSessionId(cwd: string, createdAtMs: number): string | null {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return null;
  // Build encoded cwd by replacing every non-[a-zA-Z0-9._-] char with "-".
  let encoded = "";
  for (const ch of cwd) {
    encoded += /[a-zA-Z0-9._-]/.test(ch) ? ch : "-";
  }
  const sub = join(projectsDir, encoded);
  if (!existsSync(sub)) return null;
  let bestSid: string | null = null;
  let bestMtime = createdAtMs;
  try {
    for (const f of readdirSync(sub)) {
      if (!f.endsWith(".jsonl")) continue;
      const full = join(sub, f);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        bestSid = f.replace(/\.jsonl$/, "");
      }
    }
  } catch {
    /* ignore */
  }
  return bestSid;
}

/** Send a special tmux key (C-c, Escape, Tab, etc.) to an agent's session. */
export function agentSendKey(agentId: string, keyName: string): boolean {
  return sendSpecialKey(agentId, keyName);
}

/**
 * Read historical messages from the Claude Code session jsonl file.
 * Each line is a JSON record with type "user" | "assistant".
 */
export function readClaudeHistory(sessionId: string, limit = 100): Array<{
  role: "user" | "assistant";
  text: string;
  ts: number;
}> {
  // Session files live under ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
  // We don't know the encoded cwd — scan all projects for a matching file.
  const projectsDir = join(homedir(), ".claude", "projects");
  let found: string | null = null;
  try {
    // Walk one level — each subdir is an encoded cwd.
    const subdirs = readdirSync(projectsDir);
    for (const sub of subdirs) {
      const candidate = join(projectsDir, sub, `${sessionId}.jsonl`);
      if (existsSync(candidate)) {
        found = candidate;
        break;
      }
    }
  } catch {
    return [];
  }
  if (!found) return [];

  const out: Array<{ role: "user" | "assistant"; text: string; ts: number }> = [];
  try {
    const raw = readFileSync(found, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const v = JSON.parse(trimmed) as Record<string, unknown>;
        const type = v.type as string;
        if (type !== "user" && type !== "assistant") continue;
        const msg = v.message as { content?: unknown } | undefined;
        if (!msg) continue;
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = msg.content
            .map((b) => {
              if (typeof b === "object" && b !== null) {
                const bb = b as Record<string, unknown>;
                if (typeof bb.text === "string") return bb.text as string;
                if (bb.type === "tool_use") return `[tool: ${bb.name}]`;
              }
              return "";
            })
            .join("");
        }
        if (!text) continue;
        const ts = (v.timestamp as string) ?? "";
        const tsMs = parseTs(ts);
        out.push({ role: type, text: text.slice(0, 4000), ts: tsMs });
      } catch {
        // skip bad line
      }
      if (out.length >= limit) break;
    }
  } catch {
    // ignore
  }
  return out;
}

function parseTs(s: string): number {
  // ISO 8601 like "2026-06-13T12:34:56.789Z"
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export { createAgent, listAgents, getAgent, updateAgent, deleteAgent };
export type { AgentRecord };
