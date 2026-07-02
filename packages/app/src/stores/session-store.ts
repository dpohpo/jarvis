/**
 * Session store — live conversation state for the current agent.
 *
 * Bound to one agent at a time. The 4 fields here are the things that
 * change on every message event and would force a heavy top-level
 * re-render if stored in workspace-store (which also holds the agents
 * list, host picker, etc.).
 *
 * Phase 14 wires this to JarvisClient callbacks.
 */
import { create } from "zustand";

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
  clear: () => void;
  pushLine: (b: Omit<Bubble, "id" | "ts">) => void;
  setAgent: (id: string | null) => void;
  setBusy: (v: boolean) => void;
  setLinkUp: (v: boolean) => void;
}

const MAX_LINES = 300;

export const useSessionStore = create<SessionState>((set) => ({
  currentAgentId: null,
  lines: [],
  busy: false,
  linkUp: false,
  clear: () => set({ lines: [], currentAgentId: null, busy: false }),
  pushLine: (b) =>
    set((s) => ({
      lines: [
        ...s.lines.slice(-MAX_LINES + 1),
        { ...b, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ],
    })),
  setAgent: (id) => set({ currentAgentId: id, lines: [] }),
  setBusy: (v) => set({ busy: v }),
  setLinkUp: (v) => set({ linkUp: v }),
}));
