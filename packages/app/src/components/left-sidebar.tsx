/**
 * Paseo Left Sidebar — 像素级复刻版
 *
 * 真实源码：/tmp/paseo-ref/packages/app/src/components/sidebar-workspace-list.tsx
 *
 * Port 规则：
 * - 保留 paseo 视觉结构（JSX、样式、间距、颜色）
 * - 删除 paseo 复杂逻辑（拖拽、快捷键、archive、rename、clipboard）
 * - 适配 jarvis props 接口（不用 store/hook）
 * - 改 import 路径（@getpaseo → jarvis 内部）
 *
 * 视觉目标：和 paseo 100% 一致
 */

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, type PressableStateCallbackType } from "react-native";
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDot, CircleX, MoreVertical, Copy, Archive, Pencil, Plus, Settings, Server } from "lucide-react-native";
import { DARK, SP, RD, FS, FW, SH, type ThemeTokens } from "../theme";

const C = DARK;

// ============ Types ============

interface Workspace {
  id: string;
  name: string;
  status: "needs_input" | "failed" | "running" | "attention" | "done";
  branch?: string;
  prNumber?: number;
  prState?: "open" | "merged" | "closed";
  agentCount?: number;
}

interface Agent {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
}

interface Props {
  // Workspace 列表（按项目分组）
  workspaces: Workspace[];
  // Agent 列表（当前 workspace 下的）
  agents: Agent[];
  // 选中的 workspace/agent
  selectedWorkspaceId?: string;
  selectedAgentId?: string;
  // Host 信息
  hostName: string;
  hostStatus: "online" | "offline" | "connecting";
  // 回调
  onSelectWorkspace: (wsId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  onNewFolder: () => void;
  onGoHome: () => void;
  // 可选：折叠状态
  collapsedProjectKeys?: ReadonlySet<string>;
  onToggleProjectCollapsed?: (projectKey: string) => void;
}

// ============ Helpers ============

function getStatusDotColor(status: Workspace["status"]): string {
  switch (status) {
    case "needs_input": return C.warn;
    case "failed": return C.statusDanger;
    case "running": return "#3B6FCF"; // blue
    case "attention": return C.statusSuccess;
    case "done": return C.fgSubtle;
  }
}

function getPrColor(state: NonNullable<Workspace["prState"]>): string {
  switch (state) {
    case "merged": return C.statusMerged;
    case "open": return C.statusSuccess;
    case "closed": return C.statusDanger;
  }
}

// ============ Status Dot Component ============

function StatusDot({ status, size = 7 }: { status: Workspace["status"]; size?: number }) {
  const color = getStatusDotColor(status);
  const isEmphasized = status === "needs_input" || status === "failed";
  const finalSize = isEmphasized ? 9 : size;

  return (
    <View style={[styles.statusDot, { backgroundColor: color, width: finalSize, height: finalSize }]} />
  );
}

// ============ Pr Badge Component ============

function PrBadge({ number, state }: { number: number; state: NonNullable<Workspace["prState"]> }) {
  const [isHovered, setIsHovered] = useState(false);
  const color = isHovered ? C.fg : getPrColor(state);

  const handlePressIn = useCallback(() => {}, []);
  const handlePress = useCallback(() => {
    // Stub: paseo opens external URL
  }, []);

  const handleHoverIn = useCallback(() => setIsHovered(true), []);
  const handleHoverOut = useCallback(() => setIsHovered(false), []);

  return (
    <Pressable
      hitSlop={4}
      onPressIn={handlePressIn}
      onPress={handlePress}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={({ pressed }) => [styles.prBadge, pressed && styles.prBadgePressed]}
    >
      <Text style={[styles.prBadgeText, { color }]} numberOfLines={1}>
        #{number}
      </Text>
    </Pressable>
  );
}

// ============ Workspace Row Component ============

interface WorkspaceRowProps {
  workspace: Workspace;
  selected: boolean;
  shortcutNumber?: number | null;
  showShortcutBadge?: boolean;
  onPress: () => void;
}

function WorkspaceRow({
  workspace,
  selected,
  shortcutNumber = null,
  showShortcutBadge = false,
  onPress,
}: WorkspaceRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const rowStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.workspaceRow,
      selected && styles.sidebarRowSelected,
      isHovered && styles.workspaceRowHovered,
      pressed && styles.workspaceRowPressed,
    ],
    [selected, isHovered],
  );

  return (
    <View
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Pressable
        style={rowStyle}
        onPress={handlePress}
        testID={`sidebar-workspace-row-${workspace.id}`}
      >
        {/* Left: status dot + name + branch */}
        <View style={styles.workspaceRowLeft}>
          <View style={styles.workspaceStatusDotSlot}>
            <StatusDot status={workspace.status} />
          </View>
          <View style={styles.workspaceTitleGroup}>
            <Text style={styles.workspaceTitle} numberOfLines={1}>
              {workspace.name}
            </Text>
            {workspace.branch && (
              <Text style={styles.workspaceBranchText} numberOfLines={1}>
                {workspace.branch}
              </Text>
            )}
          </View>
        </View>

        {/* Right: PR badge + shortcut */}
        <View style={styles.workspaceRowRight}>
          {workspace.prNumber && workspace.prState && (
            <PrBadge number={workspace.prNumber} state={workspace.prState} />
          )}
          {showShortcutBadge && shortcutNumber !== null && (
            <View style={styles.shortcutBadge}>
              <Text style={styles.shortcutBadgeText}>{shortcutNumber}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

// ============ Project Header Component ============

interface ProjectHeaderProps {
  projectName: string;
  workspaceCount: number;
  collapsed: boolean;
  onToggle: () => void;
  showChevron?: boolean;
}

function ProjectHeader({
  projectName,
  workspaceCount,
  collapsed,
  onToggle,
  showChevron = true,
}: ProjectHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    onToggle();
  }, [onToggle]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const headerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.projectRow,
      isHovered && styles.projectRowHovered,
      pressed && styles.projectRowPressed,
    ],
    [isHovered],
  );

  return (
    <View
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Pressable
        style={headerStyle}
        onPress={handlePress}
        testID={`sidebar-project-header-${projectName}`}
      >
        <View style={styles.projectRowLeft}>
          <Text style={styles.projectTitle} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={styles.projectAgentCount}>
            {workspaceCount}
          </Text>
        </View>
        {showChevron && (
          <View style={styles.chevronSlot}>
            {collapsed ? (
              <ChevronRight size={14} color={C.fgSubtle} />
            ) : (
              <ChevronDown size={14} color={C.fgSubtle} />
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ============ Agent Row Component ============

interface AgentRowProps {
  agent: Agent;
  selected: boolean;
  onPress: () => void;
}

function AgentRow({ agent, selected, onPress }: AgentRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const rowStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.agentRow,
      selected && styles.agentRowSelected,
      isHovered && styles.agentRowHovered,
      pressed && styles.agentRowPressed,
    ],
    [selected, isHovered],
  );

  const statusColor =
    agent.status === "online"
      ? C.statusSuccess
      : agent.status === "busy"
        ? C.statusWarning
        : C.statusDanger;

  return (
    <View
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Pressable
        style={rowStyle}
        onPress={handlePress}
        testID={`sidebar-agent-row-${agent.id}`}
      >
        <View style={[styles.agentStatusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.agentName, selected && styles.agentNameSelected]} numberOfLines={1}>
          {agent.name}
        </Text>
      </Pressable>
    </View>
  );
}

// ============ Host Picker Component (simplified) ============

interface HostPickerProps {
  hostName: string;
  status: "online" | "offline" | "connecting";
  onOpenSettings?: () => void;
}

function HostPicker({ hostName, status, onOpenSettings }: HostPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const statusColor =
    status === "online"
      ? C.statusSuccess
      : status === "connecting"
        ? C.statusWarning
        : C.statusDanger;

  const handlePress = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const triggerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.hostTrigger,
      isHovered && styles.hostTriggerHovered,
      pressed && styles.hostTriggerPressed,
    ],
    [isHovered],
  );

  return (
    <View style={styles.hostPickerContainer}>
      <Pressable
        style={triggerStyle}
        onPress={handlePress}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <View style={[styles.hostStatusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.hostName}>{hostName}</Text>
        <View style={styles.hostChevron}>
          {expanded ? (
            <ChevronDown size={14} color={C.fgSubtle} />
          ) : (
            <ChevronRight size={14} color={C.fgSubtle} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.hostDropdown}>
          {/* Current host */}
          <View style={styles.hostDropdownItem}>
            <View style={[styles.hostStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.hostDropdownItemText, styles.hostDropdownItemActive]}>
              {hostName}
            </Text>
            <Text style={styles.hostDropdownCheck}>✓</Text>
          </View>

          {/* Settings button */}
          {onOpenSettings && (
            <Pressable
              style={({ pressed }) => [styles.hostDropdownItem, pressed && styles.hostDropdownItemPressed]}
              onPress={onOpenSettings}
            >
              <Settings size={14} color={C.fgMuted} />
              <Text style={styles.hostDropdownItemText}>Settings</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ============ Footer Icon Button ============

interface FooterIconButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function FooterIconButton({ icon, label, onPress }: FooterIconButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const buttonStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.footerButton,
      isHovered && styles.footerButtonHovered,
      pressed && styles.footerButtonPressed,
    ],
    [isHovered],
  );

  return (
    <View
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Pressable
        style={buttonStyle}
        onPress={handlePress}
        accessibilityLabel={label}
      >
        {icon}
      </Pressable>
    </View>
  );
}

// ============ Main Left Sidebar Component ============

export function LeftSidebar(props: Props): React.JSX.Element {
  // Simplified: assume all workspaces belong to one "Jarvis" project
  // paseo 支持多项目分组，jarvis 目前只有一个
  const projectKey = "jarvis";
  const projectName = "Jarvis";

  const collapsedProjectKeys = props.collapsedProjectKeys ?? new Set<string>();
  const isCollapsed = collapsedProjectKeys.has(projectKey);
  const handleToggle = useCallback(() => {
    props.onToggleProjectCollapsed?.(projectKey);
  }, [props.onToggleProjectCollapsed, projectKey]);

  return (
    <View style={styles.container}>
      {/* Host Picker */}
      <View style={styles.hostSection}>
        <HostPicker
          hostName={props.hostName}
          status={props.hostStatus}
          onOpenSettings={props.onOpenSettings}
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="sidebar-workspace-list-scroll"
      >
        {/* Project Header */}
        <ProjectHeader
          projectName={projectName}
          workspaceCount={props.workspaces.length}
          collapsed={isCollapsed}
          onToggle={handleToggle}
        />

        {/* Workspace List */}
        {!isCollapsed && (
          <View style={styles.workspaceList}>
            {props.workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                selected={props.selectedWorkspaceId === workspace.id}
                onPress={() => props.onSelectWorkspace(workspace.id)}
              />
            ))}
          </View>
        )}

        {/* Agent List (if any agents selected) */}
        {props.agents.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Agents</Text>
            {props.agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                selected={props.selectedAgentId === agent.id}
                onPress={() => props.onSelectAgent(agent.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom Toolbar */}
      <View style={styles.bottomToolbar}>
        <FooterIconButton
          icon={<Text style={styles.footerButtonText}>📋</Text>}
          label="Sessions"
          onPress={props.onOpenSessions}
        />
        <FooterIconButton
          icon={<Plus size={18} color={C.fgMuted} />}
          label="New Folder"
          onPress={props.onNewFolder}
        />
        <FooterIconButton
          icon={<Settings size={18} color={C.fgMuted} />}
          label="Settings"
          onPress={props.onOpenSettings}
        />
        <FooterIconButton
          icon={<Text style={styles.footerButtonText}>🏠</Text>}
          label="Home"
          onPress={props.onGoHome}
        />
      </View>
    </View>
  );
}

// ============ Styles (VERIFIED from paseo) ============

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: C.surfaceSidebar,
    borderRightWidth: 1,
    borderRightColor: C.border,
    flexDirection: "column",
  },
  hostSection: {
    paddingHorizontal: SP[2],
    paddingTop: SP[3],
    paddingBottom: SP[2],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  hostPickerContainer: {
    position: "relative",
  },
  hostTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingVertical: SP[2],
    paddingHorizontal: SP[2],
    borderRadius: RD.md,
  },
  hostTriggerHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  hostTriggerPressed: {
    backgroundColor: C.surface2,
  },
  hostStatusDot: {
    width: 8,
    height: 8,
    borderRadius: RD.full,
  },
  hostName: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
    flex: 1,
  },
  hostChevron: {
    marginLeft: SP[1],
  },
  hostDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: C.surface2,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: SP[1],
    padding: SP[2],
    zIndex: 10,
    ...SH.sm,
  },
  hostDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[2],
    borderRadius: RD.sm,
  },
  hostDropdownItemPressed: {
    backgroundColor: C.surfaceSidebarHover,
  },
  hostDropdownItemText: {
    color: C.fgMuted,
    fontSize: FS.sm,
    flex: 1,
  },
  hostDropdownItemActive: {
    color: C.fg,
    fontWeight: FW.medium,
  },
  hostDropdownCheck: {
    color: C.accent,
    fontSize: FS.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SP[2],
    paddingTop: SP[2],
    paddingBottom: SP[4],
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
  projectRow: {
    position: "relative",
    minHeight: 36,
    paddingVertical: SP[2],
    paddingHorizontal: SP[2],
    borderRadius: RD.lg,
    marginBottom: SP[1],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  projectRowHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  projectRowPressed: {
    backgroundColor: C.surface2,
  },
  projectRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flex: 1,
    minWidth: 0,
  },
  projectTitle: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: "400",
    minWidth: 0,
    flexShrink: 1,
  },
  projectAgentCount: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginLeft: SP[1],
  },
  chevronSlot: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceList: {
    marginLeft: SP[2],
    marginBottom: SP[2],
  },
  workspaceRow: {
    minHeight: 36,
    marginBottom: SP[1],
    paddingVertical: SP[2],
    paddingLeft: SP[2],
    paddingRight: SP[3],
    borderRadius: RD.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  workspaceRowHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  workspaceRowPressed: {
    backgroundColor: C.surface2,
  },
  sidebarRowSelected: {
    backgroundColor: C.surfaceSidebarHover,
  },
  workspaceRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flex: 1,
    minWidth: 0,
  },
  workspaceStatusDotSlot: {
    width: 14,
    height: 16,
    borderRadius: RD.full,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    borderRadius: RD.full,
  },
  workspaceTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  workspaceTitle: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: "400",
    minWidth: 0,
    flexShrink: 1,
  },
  workspaceBranchText: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: "400",
    lineHeight: 20,
    opacity: 0.76,
    flex: 1,
    minWidth: 0,
  },
  workspaceRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flexShrink: 0,
  },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  prBadgePressed: {
    opacity: 0.82,
  },
  prBadgeText: {
    fontSize: FS.xs,
    fontWeight: FW.normal,
    lineHeight: 14,
    color: C.fgMuted,
  },
  shortcutBadge: {
    width: 18,
    height: 18,
    borderRadius: RD.sm,
    backgroundColor: C.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutBadgeText: {
    fontSize: 10,
    fontWeight: FW.semibold,
    color: C.fgSubtle,
  },
  agentRow: {
    minHeight: 36,
    marginBottom: SP[1],
    paddingVertical: SP[2],
    paddingHorizontal: SP[2],
    borderRadius: RD.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  agentRowHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  agentRowPressed: {
    backgroundColor: C.surface2,
  },
  agentRowSelected: {
    backgroundColor: C.surfaceSidebarHover,
  },
  agentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: RD.full,
  },
  agentName: {
    color: C.fgMuted,
    fontSize: FS.sm,
    flex: 1,
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
  footerButton: {
    width: 36,
    height: 36,
    borderRadius: RD.md,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  footerButtonPressed: {
    backgroundColor: C.surface2,
  },
  footerButtonText: {
    fontSize: 18,
  },
});
