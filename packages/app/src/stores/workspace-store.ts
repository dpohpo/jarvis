/**
 * Workspace store — projects, agents, and which is currently selected.
 *
 * Persisted to SecureStore so app restart / phone reboot doesn't drop your
 * project list (this is the "session recovery" leg of the v2 spec — the
 * chat lines themselves stay in session-store which is in-memory because
 * they're large, but the workspace index is small and durable).
 *
 * Agents shape (mirrors what the daemon emits via the protocol):
 *   { id, title, status, workspace?, provider?, model?, mode? }
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type AgentStatus = "idle" | "running" | "done" | "error" | "needs_input" | "attention";

export interface Agent {
  id: string;
  title: string;
  status: AgentStatus;
  workspace?: string;
  branch?: string;
  prNumber?: number;
  prState?: "open" | "merged" | "closed";
  provider?: string;
  model?: string;
  mode?: string;
}

const PERSIST_KEY = "jarvis_workspace_v1";

interface Persisted {
  workspaceActive: string;
  workspaceList: string[];
  agents: Agent[];
}

export async function loadWorkspace(): Promise<Persisted | null> {
  const raw = await SecureStore.getItemAsync(PERSIST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

async function persist(s: Persisted): Promise<void> {
  try {
    await SecureStore.setItemAsync(PERSIST_KEY, JSON.stringify(s));
  } catch (e) {
    // SecureStore has a 2KB limit; if the agent list outgrows it we drop
    // agents from the persisted copy (in-memory stays intact) so the
    // workspace index at least survives restart.
    if (e instanceof Error && /too large|2KB|quota/i.test(e.message)) {
      try {
        await SecureStore.setItemAsync(
          PERSIST_KEY,
          JSON.stringify({ workspaceActive: s.workspaceActive, workspaceList: s.workspaceList, agents: [] }),
        );
      } catch {
        /* give up silently */
      }
    }
  }
}

interface WorkspaceState extends Persisted {
  setWorkspaceActive: (name: string) => void;
  setWorkspaceList: (list: string[]) => void;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (a: Agent) => void;
  removeAgent: (id: string) => void;
  addWorkspace: (name: string) => void;  // dedupes
  renameWorkspace: (oldName: string, newName: string) => void;
  removeWorkspace: (name: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceActive: "",
  workspaceList: [],
  agents: [],
  setWorkspaceActive: (name) => {
    set({ workspaceActive: name });
    void persist(get());
  },
  setWorkspaceList: (list) => {
    set({ workspaceList: list });
    void persist(get());
  },
  setAgents: (agents) => {
    set({ agents });
    void persist(get());
  },
  upsertAgent: (a) => {
    set((s) => {
      const i = s.agents.findIndex((x) => x.id === a.id);
      if (i === -1) return { agents: [...s.agents, a] };
      const next = [...s.agents];
      next[i] = { ...next[i], ...a };
      return { agents: next };
    });
    void persist(get());
  },
  removeAgent: (id) => {
    set((s) => ({ agents: s.agents.filter((x) => x.id !== id) }));
    void persist(get());
  },
  addWorkspace: (name) => {
    set((s) =>
      s.workspaceList.includes(name)
        ? s
        : { workspaceList: [...s.workspaceList, name] },
    );
    void persist(get());
  },
  renameWorkspace: (oldName, newName) => {
    set((s) => {
      if (!s.workspaceList.includes(oldName) || s.workspaceList.includes(newName)) return s;
      return {
        workspaceList: s.workspaceList.map((w) => (w === oldName ? newName : w)),
        workspaceActive: s.workspaceActive === oldName ? newName : s.workspaceActive,
        agents: s.agents.map((a) => (a.workspace === oldName ? { ...a, workspace: newName } : a)),
      };
    });
    void persist(get());
  },
  removeWorkspace: (name) => {
    set((s) => ({
      workspaceList: s.workspaceList.filter((w) => w !== name),
      workspaceActive: s.workspaceActive === name ? "" : s.workspaceActive,
      agents: s.agents.filter((a) => a.workspace !== name),
    }));
    void persist(get());
  },
}));

