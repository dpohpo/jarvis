/**
 * Host / Workspace / Agent types for three-tier session navigation.
 *
 * Mirrors paseo's 1:1:1 hierarchy: one host → many workspaces → many agents.
 */

import type { AgentInfo } from "@jarvis/protocol";

/** Host represents a physical machine (Mac, iPhone, etc.). */
export interface HostInfo {
  id: string;
  name: string;
  platform: "ios" | "android" | "macos" | "windows" | "linux";
  /** When this host was last seen online. */
  lastSeen: number;
}

/** Workspace represents a project directory within a host. */
export interface WorkspaceInfo {
  name: string;
  path: string;
  /** Which agent engine this workspace uses (claude/codex). */
  engine: "claude" | "codex";
  /** Number of active agents in this workspace. */
  agentCount: number;
}

/** AgentInfo is already defined in @jarvis/protocol — re-export for convenience. */
export type { AgentInfo };
