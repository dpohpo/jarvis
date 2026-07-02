/**
 * Persistent user-facing storage for Jarvis:
 *   - memory:  facts Jarvis learned or was told (visible, editable)
 *   - settings: user preferences (voice reply on/off, default reminder, etc.)
 *   - workspaces: per-workspace mode/engine/tmuxTarget config
 *
 * All live under ~/.jarvis/. Hot-reloaded via mtime check, same pattern as
 * dict.ts — so users can edit JSON files directly without restarting daemon.
 */
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { WorkspaceConfig } from "@jarvis/protocol";

const DIR = process.env.JARVIS_HOME ?? join(homedir(), ".jarvis");
const MEMORY_FILE = join(DIR, "memory.json");
const SETTINGS_FILE = join(DIR, "settings.json");
const WORKSPACES_FILE = join(DIR, "workspaces.json");

// ---------- defaults ----------
const DEFAULT_SETTINGS: Record<string, unknown> = {
  voiceReply: true,         // speak task results out loud
  autoWake: true,           // phone auto-enables wake-word when paired
  conversationMode: false,  // continue listening after each reply
  defaultRemindMin: 10,     // minutes before an event to fire a reminder
  ttsVoice: "Tingting",     // macOS `say` voice for Chinese fallback
};

// ---------- memory ----------
export interface MemoryItem {
  key: string;
  value: string;
  category: string;
  updatedAt: number;
}

let memCache: { items: MemoryItem[]; mtime: number } | null = null;

function loadMemory(): MemoryItem[] {
  if (!existsSync(MEMORY_FILE)) return [];
  try {
    const mtime = statSync(MEMORY_FILE).mtimeMs;
    if (memCache && memCache.mtime === mtime) return memCache.items;
    const raw = JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
    const items: MemoryItem[] = Array.isArray(raw)
      ? raw.map((r: Record<string, unknown>) => ({
          key: String(r.key ?? ""),
          value: String(r.value ?? ""),
          category: String(r.category ?? "general"),
          updatedAt: Number(r.updatedAt ?? Date.now()),
        })).filter((m: MemoryItem) => m.key)
      : [];
    memCache = { items, mtime };
    return items;
  } catch {
    return [];
  }
}

function saveMemory(items: MemoryItem[]): void {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), { mode: 0o600 });
  memCache = { items, mtime: statSync(MEMORY_FILE).mtimeMs };
}

export function listMemory(): MemoryItem[] {
  return loadMemory();
}

export function updateMemory(key: string, value: string, category = "general"): MemoryItem {
  const items = loadMemory().filter((m) => m.key !== key);
  const item: MemoryItem = { key, value, category, updatedAt: Date.now() };
  items.push(item);
  saveMemory(items);
  return item;
}

export function deleteMemory(key: string): boolean {
  const before = loadMemory();
  const after = before.filter((m) => m.key !== key);
  if (after.length === before.length) return false;
  saveMemory(after);
  return true;
}

// ---------- settings ----------
let setCache: { settings: Record<string, unknown>; mtime: number } | null = null;

function loadSettings(): Record<string, unknown> {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    const mtime = statSync(SETTINGS_FILE).mtimeMs;
    if (setCache && setCache.mtime === mtime) return setCache.settings;
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    // Merge: defaults underlay saved values.
    const settings = { ...DEFAULT_SETTINGS, ...raw };
    setCache = { settings, mtime };
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: Record<string, unknown>): void {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
  setCache = { settings, mtime: statSync(SETTINGS_FILE).mtimeMs };
}

export function getAllSettings(): Record<string, unknown> {
  return loadSettings();
}

/** Allowed setting keys with their type, for cheap validation. */
const SETTING_SCHEMA: Record<string, "boolean" | "number" | "string"> = {
  voiceReply: "boolean",
  autoWake: "boolean",
  conversationMode: "boolean",
  defaultRemindMin: "number",
  ttsVoice: "string",
};

export function setSetting(key: string, value: unknown): { ok: boolean; reason?: string } {
  const expected = SETTING_SCHEMA[key];
  if (!expected) return { ok: false, reason: `unknown setting '${key}'` };
  // typeof null === "object", and JSON could give us anything; check primitive.
  const actual = Array.isArray(value) ? "array" : typeof value;
  if (actual !== expected) {
    return { ok: false, reason: `setting '${key}' expects ${expected}, got ${actual}` };
  }
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
  return { ok: true };
}

// ---------- workspace configs (Phase F) -------------------------------------
// Per-workspace {mode, engine, tmuxTarget, sessionId}. Defaults: spawn + claude.
// Stored as Record<workspaceName, WorkspaceConfig>. Hot-reloaded via mtime.
const DEFAULT_WS_CONFIG: WorkspaceConfig = {
  mode: "spawn",
  engine: "claude",
};

let wsCache: { configs: Record<string, WorkspaceConfig>; mtime: number } | null = null;

function loadWorkspaceConfigs(): Record<string, WorkspaceConfig> {
  if (!existsSync(WORKSPACES_FILE)) return {};
  try {
    const mtime = statSync(WORKSPACES_FILE).mtimeMs;
    if (wsCache && wsCache.mtime === mtime) return wsCache.configs;
    const raw = JSON.parse(readFileSync(WORKSPACES_FILE, "utf8")) as Record<string, unknown>;
    const configs: Record<string, WorkspaceConfig> = {};
    for (const [name, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      configs[name] = {
        mode: v.mode === "tmux" ? "tmux" : "spawn",
        engine: v.engine === "codex" ? "codex" : "claude",
        ...(typeof v.tmuxTarget === "string" && v.tmuxTarget
          ? { tmuxTarget: v.tmuxTarget }
          : {}),
        ...(typeof v.sessionId === "string" && v.sessionId
          ? { sessionId: v.sessionId }
          : {}),
      };
    }
    wsCache = { configs, mtime };
    return configs;
  } catch {
    return {};
  }
}

function saveWorkspaceConfigs(configs: Record<string, WorkspaceConfig>): void {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(WORKSPACES_FILE, JSON.stringify(configs, null, 2), { mode: 0o600 });
  wsCache = { configs, mtime: statSync(WORKSPACES_FILE).mtimeMs };
}

export function getAllWorkspaceConfigs(): Record<string, WorkspaceConfig> {
  return loadWorkspaceConfigs();
}

export function getWorkspaceConfig(name: string): WorkspaceConfig {
  return loadWorkspaceConfigs()[name] ?? { ...DEFAULT_WS_CONFIG };
}

export function setWorkspaceConfig(
  name: string,
  patch: Partial<WorkspaceConfig>,
): WorkspaceConfig {
  const configs = loadWorkspaceConfigs();
  const current = configs[name] ?? { ...DEFAULT_WS_CONFIG };
  const next: WorkspaceConfig = { ...current, ...patch };
  // tmux mode requires a target; if switching to tmux without one, keep spawn.
  if (next.mode === "tmux" && !next.tmuxTarget) {
    next.mode = "spawn";
  }
  configs[name] = next;
  saveWorkspaceConfigs(configs);
  return next;
}

/** Persist a freshly-acquired session id back to the workspace config (spawn mode). */
export function setWorkspaceSessionId(name: string, sessionId: string): void {
  const configs = loadWorkspaceConfigs();
  const current = configs[name];
  if (!current || current.sessionId === sessionId) return;
  configs[name] = { ...current, sessionId };
  saveWorkspaceConfigs(configs);
}
