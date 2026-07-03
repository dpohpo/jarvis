/**
 * Session store — per-agent conversation state with AsyncStorage persistence.
 *
 * DESIGN (user directive): chat history is a FRONTEND concern.
 * Every pushLine writes to AsyncStorage immediately. setAgent loads
 * from AsyncStorage before displaying. App restart auto-restores
 * the last session. No daemon replay needed.
 *
 * Key format: jarvis_session_lines_<agentId>
 * Agent ID = agent title (stable across daemon restarts).
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Bubble {
  id: string;
  kind: "user" | "assistant" | "tool" | "error" | "system" | "local";
  text: string;
  ts: number;
}

interface SessionState {
  currentAgentId: string | null;
  lines: Bubble[];
  busy: boolean;
  linkUp: boolean;
  hydrated: boolean;
  clear: () => void;
  pushLine: (b: Omit<Bubble, "id" | "ts">) => void;
  pushLineForAgent: (agentId: string, b: Omit<Bubble, "id" | "ts">) => void;
  setAgent: (id: string | null) => void;
  setBusy: (v: boolean) => void;
  setLinkUp: (v: boolean) => void;
  hydrateForAgent: (id: string) => Promise<void>;
  restoreLastAgent: () => Promise<void>;
}

const MAX_LINES = 300;
const KEY_PREFIX = "jarvis_session_lines_";
const LAST_AGENT_KEY = "jarvis_last_agent";

// --- AsyncStorage helpers ---

async function readLines(agentId: string): Promise<Bubble[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + agentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bubble[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_LINES) : [];
  } catch {
    return [];
  }
}

async function writeLines(agentId: string, lines: Bubble[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + agentId, JSON.stringify(lines.slice(-MAX_LINES)));
  } catch {
    // best-effort
  }
}

// Debounced writer per agent — coalesce rapid pushLine bursts.
const writeTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleWrite(agentId: string, lines: Bubble[]): void {
  if (writeTimers[agentId]) clearTimeout(writeTimers[agentId]);
  writeTimers[agentId] = setTimeout(() => {
    void writeLines(agentId, lines);
  }, 100);
}

// In-memory cache: agentId → Bubble[]. Survives session switches within
// one app launch. AsyncStorage is the persistent backup for restarts.
const lineCache = new Map<string, Bubble[]>();

export const useSessionStore = create<SessionState>((set, get) => ({
  currentAgentId: null,
  lines: [],
  busy: false,
  linkUp: false,
  hydrated: false,

  clear: () => {
    const cur = get().currentAgentId;
    if (cur) {
      lineCache.delete(cur);
      void AsyncStorage.removeItem(KEY_PREFIX + cur).catch(() => {});
    }
    set({ lines: [], currentAgentId: null, busy: false });
    void AsyncStorage.removeItem(LAST_AGENT_KEY).catch(() => {});
  },

  pushLine: (b) => {
    const cur = get().currentAgentId ?? "default";
    get().pushLineForAgent(cur, b);
  },

  /** Push to a specific agent — the core session isolation method.
   *  Writes to in-memory cache + AsyncStorage immediately. */
  pushLineForAgent: (agentId, b) => {
    const bubble: Bubble = { ...b, id: `${Date.now()}-${Math.random()}`, ts: Date.now() };
    const cached = lineCache.get(agentId) ?? [];
    const updated = [...cached.slice(-MAX_LINES + 1), bubble];
    lineCache.set(agentId, updated);
    // Persist to AsyncStorage (debounced 100ms).
    scheduleWrite(agentId, updated);
    // Update display only if this is the currently shown agent.
    if (get().currentAgentId === agentId) {
      set({ lines: updated });
    }
  },

  /** Switch to a different session. Clears lines — daemon /history
   *  replay (triggered by useJarvis effect) will fill them from
   *  agents.sqlite on Mac. AsyncStorage is offline fallback only. */
  setAgent: (id) => {
    set({ currentAgentId: id, lines: [], hydrated: false });
    if (!id) {
      set({ hydrated: true });
      return;
    }
    void AsyncStorage.setItem(LAST_AGENT_KEY, id).catch(() => {});
    // Mark hydrated — actual data comes from daemon /history replay.
    // If daemon offline, hydrate from AsyncStorage as fallback.
    const cached = lineCache.get(id);
    if (cached && cached.length > 0) {
      set({ lines: cached, hydrated: true });
    } else {
      set({ hydrated: true }); // empty until daemon replays
    }
  },

  setBusy: (v) => set({ busy: v }),
  setLinkUp: (v) => set({ linkUp: v }),

  hydrateForAgent: async (id) => {
    const lines = await readLines(id);
    lineCache.set(id, lines);
    if (get().currentAgentId === id) {
      set({ lines, hydrated: true });
    }
  },

  /** Called on app boot — reads last agent + restores its chat. */
  restoreLastAgent: async () => {
    try {
      const lastId = await AsyncStorage.getItem(LAST_AGENT_KEY);
      if (lastId) {
        // Load lines from AsyncStorage BEFORE setting agent (so setAgent
        // finds them in cache and shows immediately, no flash).
        const lines = await readLines(lastId);
        lineCache.set(lastId, lines);
        get().setAgent(lastId);
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
