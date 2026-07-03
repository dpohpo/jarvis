/**
 * Session store — live conversation state for the current agent.
 *
 * Bound to one agent at a time. The 4 fields here are the things that
 * change on every message event and would force a heavy top-level
 * re-render if stored in workspace-store (which also holds the agents
 * list, host picker, etc.).
 *
 * Phase 14 wires this to JarvisClient callbacks.
 * Phase 15-v6: lines are now persisted per-agent to AsyncStorage so
 * restarting the app restores the conversation you were in. The store
 * loads on setAgent() (lazy) and writes through on every pushLine
 * (debounced). busy / linkUp stay in-memory — they're transient.
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
  busy: boolean;        // task in flight
  linkUp: boolean;      // daemon reachable
  hydrated: boolean;    // first AsyncStorage load done
  clear: () => void;
  pushLine: (b: Omit<Bubble, "id" | "ts">) => void;
  setAgent: (id: string | null) => void;
  setBusy: (v: boolean) => void;
  setLinkUp: (v: boolean) => void;
  hydrateForAgent: (id: string) => Promise<void>;
  restoreLastAgent: () => Promise<void>;
}

const MAX_LINES = 300;
const KEY_PREFIX = "jarvis_session_lines_";
const LAST_AGENT_KEY = "jarvis_last_agent";

/** Read persisted lines for an agent (or empty array). */
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

/** Debounced writer — coalesce 5+ rapid pushLine into one write. */
let writeScheduled: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleWrite(agentId: string, getLines: () => Bubble[]) {
  if (writeScheduled[agentId]) clearTimeout(writeScheduled[agentId]);
  writeScheduled[agentId] = setTimeout(() => {
    const lines = getLines();
    void AsyncStorage.setItem(KEY_PREFIX + agentId, JSON.stringify(lines)).catch(() => {
      // Best-effort — don't crash app if storage is full.
    });
  }, 250);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentAgentId: null,
  lines: [],
  busy: false,
  linkUp: false,
  hydrated: false,

  clear: () => {
    const cur = get().currentAgentId;
    if (cur) {
      void AsyncStorage.removeItem(KEY_PREFIX + cur).catch(() => {});
    }
    set({ lines: [], currentAgentId: null, busy: false });
  },

  pushLine: (b) => {
    const next: Bubble = { ...b, id: `${Date.now()}-${Math.random()}`, ts: Date.now() };
    set((s) => {
      const lines = [...s.lines.slice(-MAX_LINES + 1), next];
      const cur = s.currentAgentId;
      if (cur) scheduleWrite(cur, () => lines);
      return { lines };
    });
  },

  setAgent: (id) => {
    set({ currentAgentId: id, lines: [], hydrated: false });
    if (id) {
      // Persist last agent so app restart auto-restores the conversation.
      void AsyncStorage.setItem(LAST_AGENT_KEY, id).catch(() => {});
      void get().hydrateForAgent(id);
    } else {
      void AsyncStorage.removeItem(LAST_AGENT_KEY).catch(() => {});
      set({ hydrated: true });
    }
  },

  setBusy: (v) => set({ busy: v }),
  setLinkUp: (v) => set({ linkUp: v }),

  hydrateForAgent: async (id) => {
    const lines = await readLines(id);
    if (get().currentAgentId === id) {
      set({ lines, hydrated: true });
    }
  },

  /** Called on app boot — reads last agent from AsyncStorage and restores. */
  restoreLastAgent: async () => {
    try {
      const lastId = await AsyncStorage.getItem(LAST_AGENT_KEY);
      if (lastId) {
        get().setAgent(lastId);
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
