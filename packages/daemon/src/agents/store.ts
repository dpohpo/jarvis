/**
 * Agent store — persistent multi-session agent registry.
 *
 * Agents are Paseo-style work units: each agent has its own session-id
 * (Claude Code `--resume` target or Codex rollout thread id) and lives
 * across app restarts. Stored in ~/.jarvis/agents.sqlite so daemon restart
 * doesn't lose state.
 */
import Database from "better-sqlite3";
import { ulid } from "ulid";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

export interface AgentRecord {
  id: string;
  workspace: string;
  /** Legacy engine field (use provider instead). Kept for compatibility. */
  engine: "claude" | "codex";
  /** Provider ID (claude, codex, copilot, gemini). Defaults to "claude". */
  provider: string;
  /** Optional model override (e.g. "claude-opus-4-6", "gpt-5"). */
  model: string | null;
  session_id: string | null;
  title: string;
  created_at: number;
  last_active: number;
  status: "idle" | "running" | "done" | "error";
  cwd: string;
  message_count: number;
}

const DB_PATH = process.env.JARVIS_AGENTS_DB ?? join(homedir(), ".jarvis", "agents.sqlite");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Create table with new schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace TEXT NOT NULL,
      engine TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'claude',
      model TEXT,
      session_id TEXT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_active INTEGER NOT NULL,
      status TEXT NOT NULL,
      cwd TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active DESC);
    CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace);
  `);

  // Migration: add provider/model columns if they don't exist (legacy DB)
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'").get() as { sql: string } | undefined;
    if (row && !row.sql.includes("provider TEXT")) {
      db.exec("ALTER TABLE agents ADD COLUMN provider TEXT NOT NULL DEFAULT 'claude'");
    }
    if (row && !row.sql.includes("model TEXT")) {
      db.exec("ALTER TABLE agents ADD COLUMN model TEXT");
    }
  } catch (e) {
    // Column may already exist, ignore error
  }

  return db;
}

export function createAgent(input: {
  /** Optional client-supplied id. When set, the daemon uses it as the primary
   *  key instead of generating `agent-${ulid()}`. This lets the phone
   *  setSelectedAgentId(id) immediately on submit without waiting for the
   *  agent.state push round-trip — same pattern as CmdSubmit.cmdId. */
  id?: string;
  workspace: string;
  /** Legacy engine field (use provider instead). Kept for compatibility. */
  engine?: "claude" | "codex";
  /** Provider ID (claude, codex, copilot, gemini). Defaults to "claude". */
  provider?: string;
  /** Optional model override (e.g. "claude-opus-4-6", "gpt-5"). */
  model?: string;
  cwd: string;
  title: string;
}): AgentRecord {
  const now = Date.now();
  const provider = input.provider ?? input.engine ?? "claude";
  const agent: AgentRecord = {
    id: input.id ?? `agent-${ulid().toLowerCase()}`,
    workspace: input.workspace,
    engine: input.engine ?? (provider as "claude" | "codex"),
    provider,
    model: input.model ?? null,
    session_id: null,
    title: input.title,
    created_at: now,
    last_active: now,
    status: "idle",
    cwd: input.cwd,
    message_count: 0,
  };
  getDb()
    .prepare(
      `INSERT INTO agents (id, workspace, engine, provider, model, session_id, title, created_at, last_active, status, cwd, message_count)
       VALUES (@id, @workspace, @engine, @provider, @model, @session_id, @title, @created_at, @last_active, @status, @cwd, @message_count)`,
    )
    .run({
      ...agent,
      session_id: agent.session_id ?? null,
      model: agent.model ?? null,
    });
  return agent;
}

export function listAgents(limit = 50): AgentRecord[] {
  return getDb()
    .prepare(`SELECT * FROM agents ORDER BY last_active DESC LIMIT ?`)
    .all(limit) as AgentRecord[];
}

export function getAgent(id: string): AgentRecord | null {
  return (getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as AgentRecord | undefined) ?? null;
}

export function updateAgent(id: string, patch: Partial<Omit<AgentRecord, "id" | "workspace" | "created_at" | "cwd">>): AgentRecord | null {
  const current = getAgent(id);
  if (!current) return null;
  const next = { ...current, ...patch, last_active: Date.now() };
  getDb()
    .prepare(
      `UPDATE agents SET provider=@provider, model=@model, session_id=@session_id, title=@title, last_active=@last_active,
         status=@status, message_count=@message_count WHERE id=@id`,
    )
    .run({
      id: next.id,
      provider: next.provider,
      model: next.model ?? null,
      session_id: next.session_id ?? null,
      title: next.title,
      last_active: next.last_active,
      status: next.status,
      message_count: next.message_count,
    });
  return next;
}

export function deleteAgent(id: string): boolean {
  const r = getDb().prepare(`DELETE FROM agents WHERE id = ?`).run(id);
  return r.changes > 0;
}

export function exists(): boolean {
  return existsSync(DB_PATH);
}
