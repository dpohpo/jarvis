/**
 * useSessionTree — builds the Host → Workspace → Agent hierarchy.
 *
 * Combines:
 * - hosts state (from HostContext)
 * - workspace state (from App.tsx workspaceActive/workspaceList)
 * - agents state (from App.tsx agents)
 *
 * Returns navigation helpers for each tier.
 */

import { useMemo } from "react";
import { useHosts } from "./host-context";
import type { HostInfo, WorkspaceInfo, AgentInfo } from "./host-types";

interface SessionTree {
  /** All hosts with their workspaces and agents nested inside. */
  hosts: HostInfo[];
  /** Currently selected host. */
  currentHost: HostInfo | null;
  /** All workspaces across all hosts (flat list for picker). */
  workspaces: WorkspaceInfo[];
  /** All agents across all workspaces (flat list for picker). */
  agents: AgentInfo[];
}

interface SessionTreeActions {
  /** Switch to a specific host. */
  navigateToHost: (hostId: string) => void;
  /** Switch to a specific workspace. */
  navigateToWorkspace: (workspaceName: string) => void;
  /** Switch to a specific agent (resume conversation). */
  navigateToAgent: (agentId: string) => void;
}

interface UseSessionTreeOptions {
  /** Current workspace name from App.tsx. */
  currentWorkspace: string;
  /** All workspace names from App.tsx. */
  workspaceList: string[];
  /** All agents from App.tsx. */
  agents: AgentInfo[];
  /** Callback when workspace changes. */
  onSwitchWorkspace: (name: string) => void;
  /** Callback when agent changes. */
  onSelectAgent: (id: string | null) => void;
}

export function useSessionTree(options: UseSessionTreeOptions): {
  tree: SessionTree;
  actions: SessionTreeActions;
} {
  const { hosts, currentHost, setCurrentHost } = useHosts();
  const {
    currentWorkspace,
    workspaceList,
    agents,
    onSwitchWorkspace,
    onSelectAgent,
  } = options;

  // Build workspace list with metadata (agent count, engine, etc.)
  const workspaces = useMemo((): WorkspaceInfo[] => {
    const wsMap = new Map<string, WorkspaceInfo>();

    // Add each workspace from the daemon's list
    for (const name of workspaceList) {
      // Count agents in this workspace
      const wsAgents = agents.filter((a) => a.workspace === name);
      const engine = wsAgents[0]?.engine ?? "claude";

      wsMap.set(name, {
        name,
        path: name, // Phase 1: workspace name = path (protocol will add real paths later)
        engine,
        agentCount: wsAgents.length,
      });
    }

    // Add "主目录" (empty workspace) if it has agents or is active
    const homeAgents = agents.filter((a) => !a.workspace || a.workspace === "");
    if (homeAgents.length > 0 || currentWorkspace === "") {
      wsMap.set("", {
        name: "主目录",
        path: "",
        engine: homeAgents[0]?.engine ?? "claude",
        agentCount: homeAgents.length,
      });
    }

    return Array.from(wsMap.values()).sort((a, b) => {
      if (a.name === "主目录") return -1;
      if (b.name === "主目录") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [workspaceList, agents, currentWorkspace]);

  const tree: SessionTree = useMemo(
    () => ({
      hosts,
      currentHost,
      workspaces,
      agents,
    }),
    [hosts, currentHost, workspaces, agents],
  );

  const actions: SessionTreeActions = useMemo(
    () => ({
      navigateToHost: (hostId: string) => {
        const host = hosts.find((h) => h.id === hostId);
        if (host) setCurrentHost(host);
      },
      navigateToWorkspace: onSwitchWorkspace,
      navigateToAgent: onSelectAgent,
    }),
    [hosts, setCurrentHost, onSwitchWorkspace, onSelectAgent],
  );

  return { tree, actions };
}
