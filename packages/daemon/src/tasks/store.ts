/**
 * Task persistence: survives daemon restarts so the phone can always ask "what was running?".
 * Claude Code sessions themselves resume via `--resume <sessionId>`.
 */
import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import type { TaskSummary } from "@jarvis/protocol";

export type TaskStatus = TaskSummary["status"];

export interface TaskRow {
  taskId: string;
  status: TaskStatus;
  title: string;
  workdir: string;
  agentSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export class TaskStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = process.env.JARVIS_HOME ?? join(homedir(), ".jarvis");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new Database(dbPath ?? join(dir, "tasks.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        workdir TEXT NOT NULL,
        agent_session_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        ev TEXT NOT NULL,
        data TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
    `);
  }

  create(taskId: string, title: string, workdir: string): void {
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO tasks (task_id, status, title, workdir, created_at, updated_at) VALUES (?, 'running', ?, ?, ?, ?)",
      )
      .run(taskId, title, workdir, now, now);
  }

  setStatus(taskId: string, status: TaskStatus): void {
    this.db
      .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?")
      .run(status, Date.now(), taskId);
  }

  setAgentSession(taskId: string, sessionId: string): void {
    this.db
      .prepare("UPDATE tasks SET agent_session_id = ?, updated_at = ? WHERE task_id = ?")
      .run(sessionId, Date.now(), taskId);
  }

  addEvent(taskId: string, ev: string, data: string): void {
    this.db
      .prepare("INSERT INTO events (task_id, ev, data, ts) VALUES (?, ?, ?, ?)")
      .run(taskId, ev, data, Date.now());
  }

  get(taskId: string): TaskRow | undefined {
    return this.mapRow(
      this.db.prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId) as
        | Record<string, unknown>
        | undefined,
    );
  }

  list(limit = 50): TaskRow[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r)!);
  }

  /** Anything still marked running when the daemon starts was orphaned by a crash. */
  markOrphans(): void {
    this.db
      .prepare("UPDATE tasks SET status = 'paused', updated_at = ? WHERE status = 'running'")
      .run(Date.now());
  }

  private mapRow(r: Record<string, unknown> | undefined): TaskRow | undefined {
    if (!r) return undefined;
    return {
      taskId: r.task_id as string,
      status: r.status as TaskStatus,
      title: r.title as string,
      workdir: r.workdir as string,
      agentSessionId: (r.agent_session_id as string | null) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }
}
