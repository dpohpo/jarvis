/**
 * Host store — persistent registry of known Mac hosts.
 *
 * Phone can register multiple hosts and switch between them.
 * Stored in ~/.jarvis/hosts.sqlite so daemon restart doesn't lose state.
 */
import Database from "better-sqlite3";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

export interface HostRecord {
  id: string;
  name: string;
  hostname: string;
  status: "online" | "offline";
  lastSeen: number;
}

const DB_PATH = process.env.JARVIS_HOSTS_DB ?? join(homedir(), ".jarvis", "hosts.sqlite");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hosts_last_seen ON hosts(last_seen DESC);
  `);

  // Migration: rename last_seen column to lastSeen if needed
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='hosts'").get() as { sql: string } | undefined;
    if (row && row.sql.includes("last_seen") && !row.sql.includes("lastSeen")) {
      // SQLite doesn't support ALTER TABLE RENAME COLUMN directly, need to recreate table
      db.exec(`
        CREATE TABLE hosts_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          hostname TEXT NOT NULL,
          status TEXT NOT NULL,
          lastSeen INTEGER NOT NULL
        );
        INSERT INTO hosts_new (id, name, hostname, status, lastSeen)
          SELECT id, name, hostname, status, last_seen FROM hosts;
        DROP TABLE hosts;
        ALTER TABLE hosts_new RENAME TO hosts;
        CREATE INDEX IF NOT EXISTS idx_hosts_last_seen ON hosts(lastSeen DESC);
      `);
    }
  } catch (e) {
    // Migration may fail if table already has correct schema, ignore
  }

  return db;
}

/**
 * Register or update a host. Called when phone registers a host.
 */
export function registerHost(host: HostRecord): void {
  getDb().prepare(`
    INSERT INTO hosts (id, name, hostname, status, lastSeen)
    VALUES (@id, @name, @hostname, @status, @lastSeen)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      hostname = @hostname,
      status = @status,
      lastSeen = @lastSeen
  `).run({
    id: host.id,
    name: host.name,
    hostname: host.hostname,
    status: host.status,
    lastSeen: host.lastSeen,
  });
}

/**
 * List all known hosts.
 */
export function listHosts(): HostRecord[] {
  return getDb().prepare(`SELECT * FROM hosts ORDER BY lastSeen DESC`).all() as HostRecord[];
}

/**
 * Remove a host from the registry.
 */
export function removeHost(id: string): boolean {
  const r = getDb().prepare(`DELETE FROM hosts WHERE id = ?`).run(id);
  return r.changes > 0;
}

/**
 * Update host status and lastSeen timestamp.
 */
export function updateHostStatus(id: string, status: "online" | "offline", lastSeen?: number): boolean {
  const lastSeenVal = lastSeen ?? Date.now();
  const r = getDb().prepare(`
    UPDATE hosts SET status = @status, lastSeen = @lastSeen WHERE id = @id
  `).run({ id, status, lastSeen: lastSeenVal });
  return r.changes > 0;
}

/**
 * Check if hosts DB exists.
 */
export function exists(): boolean {
  return existsSync(DB_PATH);
}
