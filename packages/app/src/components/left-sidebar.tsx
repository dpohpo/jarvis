/**
 * Paseo-style left sidebar — compact navigation panel.
 *
 * Structure:
 *   - Top: HostPicker (current daemon name + status)
 *   - Middle: Workspace list (grouped/collapsible)
 *   - Middle-bottom: Agent list (within current workspace)
 *   - Bottom: 4 icon buttons (Sessions / New Folder / Settings / Home)
 *
 * VERIFIED 2026-06-30 against paseo left-sidebar design.
 */

import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { DARK, SP, RD, FS, FW, type ThemeTokens } from "../theme";

const C = DARK;

interface Workspace {
  id: string;
  name: string;
  agentCount?: number;
}

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
}

interface Props {
  workspaces: Workspace[];
  agents: Agent[];
  selectedAgentId?: string;
  hostName: string;
  hostStatus: "online" | "offline" | "connecting";
  onSelectWorkspace: (wsId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onNewFolder: () => void;
  onGoHome: () => void;
}

export function LeftSidebar(props: Props): React.JSX.Element {
  const [expandedWs, setExpandedWs] = React.useState<string | null>(
    props.workspaces[0]?.id || null
  );

  const renderWorkspace = (ws: Workspace) => {
    const isExpanded = expandedWs === ws.id;
    return (
      <View key={ws.id} style={styles.workspaceSection}>
        <TouchableOpacity
          style={[styles.workspaceHeader, isExpanded && styles.workspaceHeaderExpanded]}
          onPress={() => setExpandedWs(isExpanded ? null : ws.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.workspaceName}>{ws.name}</Text>
          <View style={styles.chevron}>
            <Text style={styles.chevronText}>{isExpanded ? "▼" : "▶"}</Text>
          </View>
        </TouchableOpacity>
        {ws.agentCount !== undefined && (
          <Text style={styles.agentCount}>{ws.agentCount} agents</Text>
        )}
      </View>
    );
  };

  const renderAgent = (agent: Agent) => {
    const isSelected = props.selectedAgentId === agent.id;
    const statusColor =
      agent.status === "online"
        ? C.statusSuccess
        : agent.status === "busy"
          ? C.statusWarning
          : C.statusDanger;

    return (
      <TouchableOpacity
        key={agent.id}
        style={[styles.agentItem, isSelected && styles.agentItemSelected]}
        onPress={() => props.onSelectAgent(agent.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.agentName, isSelected && styles.agentNameSelected]}>
          {agent.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Host Picker (stub for now — single host) */}
      <View style={styles.hostSection}>
        <View style={[styles.statusDot, { backgroundColor: C.statusSuccess }]} />
        <Text style={styles.hostName}>{props.hostName}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Workspace List */}
        <Text style={styles.sectionLabel}>工作空间</Text>
        {props.workspaces.map(renderWorkspace)}

        {/* Agent List */}
        {expandedWs && (
          <>
            <Text style={styles.sectionLabel}>Agents</Text>
            {props.agents.map(renderAgent)}
          </>
        )}
      </ScrollView>

      {/* Bottom Toolbar */}
      <View style={styles.bottomToolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={props.onOpenSessions}>
          <Text style={styles.toolbarIcon}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={props.onNewFolder}>
          <Text style={styles.toolbarIcon}>📁</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={props.onOpenSettings}>
          <Text style={styles.toolbarIcon}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={props.onGoHome}>
          <Text style={styles.toolbarIcon}>🏠</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: C.surfaceSidebar,
    borderRightWidth: 1,
    borderRightColor: C.border,
    flexDirection: "column",
  },
  hostSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[4],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: RD.full,
  },
  hostName: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SP[3],
  },
  sectionLabel: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    marginTop: SP[3],
    marginBottom: SP[2],
    paddingHorizontal: SP[2],
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  workspaceSection: {
    marginBottom: SP[2],
  },
  workspaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SP[2],
    borderRadius: RD.md,
  },
  workspaceHeaderExpanded: {
    backgroundColor: C.surfaceSidebarHover,
  },
  workspaceName: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  chevron: {
    padding: SP[1],
  },
  chevronText: {
    color: C.fgSubtle,
    fontSize: FS.xs,
  },
  agentCount: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginLeft: SP[3],
    marginTop: SP[1],
  },
  agentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[2],
    borderRadius: RD.md,
    marginBottom: SP[1],
  },
  agentItemSelected: {
    backgroundColor: C.surfaceSidebarHover,
  },
  agentName: {
    color: C.fgMuted,
    fontSize: FS.sm,
  },
  agentNameSelected: {
    color: C.fg,
    fontWeight: FW.medium,
  },
  bottomToolbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    gap: SP[3],
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: RD.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarIcon: {
    fontSize: 18,
  },
});
