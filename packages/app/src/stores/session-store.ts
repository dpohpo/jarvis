/**
 * Session store — per-agent conversation state.
 *
 * Each agent (session) has its own Bubble[] stored in `allLines` Map.
 * `lines` is just a view into allLines[currentAgentId].
 *
 * When a task.event arrives, useJarvis routes it via pushLineForAgent()
 * using cmdId → agentId mapping. This ensures replies land in the
 * correct session even when the user has switched to a different one.
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
  allLines: Map<string, Bubble[]>;
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

let writeScheduled: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleWrite(agentId: string, getLines: () => Bubble[]) {
  if (writeScheduled[agentId]) clearTimeout(writeScheduled[agentId]);
  writeScheduled[agentId] = setTimeout(() => {
    const lines = getLines();
    void AsyncStorage.setItem(KEY_PREFIX + agentId, JSON.stringify(lines)).catch(() => {});
  }, 150);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentAgentId: null,
  allLines: new Map<string, Bubble[]>(),
  lines: [],
  busy: false,
  linkUp: false,
  hydrated: false,

  clear: () => {
    const cur = get().currentAgentId;
    if (cur) {
      get().allLines.delete(cur);
      void AsyncStorage.removeItem(KEY_PREFIX + cur).catch(() => {});
    }
    set({ lines: [], currentAgentId: null, busy: false });
  },

  pushLine: (b) => {
    const cur = get().currentAgentId;
    if (!cur) return;
    get().pushLineForAgent(cur, b);
  },

  /** Push a bubble to a SPECIFIC agent's lines — not necessarily the
   *  currently-displayed one. This is the key method for session
   *  isolation: daemon replies are routed here with the agentId
   *  recovered from cmdId mapping. */
  pushLineForAgent: (agentId, b) => {
    const next: Bubble = { ...b, id: `${Date.now()}-${Math.random()}`, ts: Date.now() };
    const all = get().allLines;
    const existing = all.get(agentId) ?? [];
    const updated = [...existing.slice(-MAX_LINES + 1), next];
    all.set(agentId, updated);
    scheduleWrite(agentId, () => updated);
    // Only update display lines if this is the currently-shown agent.
    if (get().currentAgentId === agentId) {
      set({ lines: updated });
    }
  },

  setAgent: (id) => {
    set({ currentAgentId: id, hydrated: false });
    if (id) {
      void AsyncStorage.setItem(LAST_AGENT_KEY, id).catch(() => {});
      // If we already have this agent's lines in memory, show immediately.
      const existing = get().allLines.get(id);
      if (existing) {
        set({ lines: existing, hydrated: true });
      } else {
        set({ lines: [] });
        void get().hydrateForAgent(id);
      }
    } else {
      void AsyncStorage.removeItem(LAST_AGENT_KEY).catch(() => {});
      set({ lines: [], hydrated: true });
    }
  },

  setBusy: (v) => set({ busy: v }),
  setLinkUp: (v) => set({ linkUp: v }),

  hydrateForAgent: async (id) => {
    const lines = await readLines(id);
    get().allLines.set(id, lines);
    if (get().currentAgentId === id) {
      set({ lines, hydrated: true });
    }
  },

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
