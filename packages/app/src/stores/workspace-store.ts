/**
 * Workspace store — projects, agents, and which is currently selected.
 *
 * Phase 14 hooks this up to client.requestAgentList / switchWorkspace /
 * agentRename / deleteAgent. For Phase 6 the shape is locked so components
 * can render against it without the daemon connection being live yet.
 *
 * Agents shape (mirrors what the daemon emits via the protocol):
 *   { id, title, status, workspace?, provider?, model?, mode? }
 */
import { create } from "zustand";

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

interface WorkspaceState {
  workspaceActive: string;       // active project name ("" = none)
  workspaceList: string[];       // known project names
  agents: Agent[];               // sessions/agents across all workspaces
  setWorkspaceActive: (name: string) => void;
  setWorkspaceList: (list: string[]) => void;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (a: Agent) => void;
  removeAgent: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaceActive: "",
  workspaceList: [],
  agents: [],
  setWorkspaceActive: (name) => set({ workspaceActive: name }),
  setWorkspaceList: (list) => set({ workspaceList: list }),
  setAgents: (agents) => set({ agents }),
  upsertAgent: (a) =>
    set((s) => {
      const i = s.agents.findIndex((x) => x.id === a.id);
      if (i === -1) return { agents: [...s.agents, a] };
      const next = [...s.agents];
      next[i] = { ...next[i], ...a };
      return { agents: next };
    }),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter((x) => x.id !== id) })),
}));
