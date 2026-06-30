/**
 * PaseoShell — paseo-style shell wrapping jarvis' existing state.
 *
 * Layout (mobile):
 *   ┌────────────────────────────────────┐
 *   │ Header (menu / status / new / ws)  │  ← reused from App.tsx
 *   ├──────────┬─────────────────────────┤
 *   │ Sidebar  │ Stream (ChatList)       │  ← drawer overlay on mobile
 *   │ (Left)   │                         │
 *   │          ├─────────────────────────┤
 *   │          │ Composer                │
 *   └──────────┴─────────────────────────┘
 *
 * This file is the **integration layer** between the 5 paseo-style component
 * modules built by agents B/C/D/E/F and jarvis' existing App.tsx state shape.
 * It maps jarvis state → paseo component props without rewriting App.tsx.
 *
 * Why a separate shell:
 *  - App.tsx is 2900+ lines of business logic; rewriting breaks voice/brain
 *  - PaseoShell lets us swap in paseo UI in one place
 *  - Phase 2+ can migrate more App.tsx logic into hooks/stores incrementally
 */
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DARK, SP, RD, FS, FW, SH, type ThemeTokens } from "./theme";
import { LeftSidebar } from "./components/left-sidebar";
import { ChatList, type Bubble } from "./components/chat-list";
import { Composer } from "./components/composer";
import { CommandCenter } from "./components/command-center";
import type { AgentInfo } from "@jarvis/protocol";

const C: ThemeTokens = DARK;

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360);

/** Shape jarvis' workspace list (string[]) into LeftSidebar's Workspace[]. */
function toWorkspaces(names: string[]): Array<{ id: string; name: string; agentCount?: number }> {
  return names.map((name) => ({ id: name || "_root", name: name || "主目录" }));
}

/** Shape jarvis' agents into LeftSidebar's Agent[]. */
function toSidebarAgents(
  agents: AgentInfo[],
): Array<{ id: string; name: string; status: "online" | "offline" | "busy" }> {
  return agents.map((a) => ({
    id: a.id,
    name: a.title || "(无标题)",
    status:
      a.status === "running" ? "busy" : a.status === "done" ? "online" : "offline",
  }));
}

export interface PaseoShellProps {
  // Chat surface — typed loose (any[]) because jarvis' App.tsx Bubble and the
  // new paseo ChatList Bubble have slightly different union members ("task"
  // kind exists in jarvis but not yet in the new component). Phase 3 will
  // unify them; for now we cast at the call site.
  lines: Bubble[] | any[];
  busy: boolean;
  // Workspace
  workspaceActive: string;
  workspaceList: string[];
  onSwitchWorkspace: (name: string) => void;
  // Agents
  agents: AgentInfo[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onDeleteAgent: (id: string) => void;
  onRenameAgent: (agent: AgentInfo, newTitle: string) => void;
  onStopAgent: (id: string) => void;
  // Composer
  input: string;
  onChangeInput: (text: string) => void;
  onSubmit: () => void;
  recording: boolean;
  onToggleRecording: () => void;
  // Host (single-host mode for now)
  hostName: string;
  linkUp: boolean;
  // Settings
  onOpenSettings: () => void;
  // Bubble renderer (jarvis' existing BubbleView)
  renderBubble: (b: Bubble) => React.ReactNode;
}

export function PaseoShell(props: PaseoShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  };

  const pill = props.linkUp
    ? { color: C.accentBright, label: "在线" }
    : { color: C.fgSubtle, label: "离线" };

  return (
    <KeyboardAvoidingView
      style={shellStyles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* §6 Header — paseo compact style */}
      <View style={shellStyles.header}>
        <Pressable style={shellStyles.headerBtn} onPress={openDrawer}>
          <Text style={shellStyles.headerIcon}>☰</Text>
        </Pressable>
        <View style={shellStyles.statusWrap}>
          <View style={[shellStyles.statusDot, { backgroundColor: pill.color }]} />
          <Text style={[shellStyles.statusLabel, { color: pill.color }]}>{pill.label}</Text>
        </View>
        <Pressable
          style={[shellStyles.headerBtn, { opacity: props.selectedAgentId ? 1 : 0.4 }]}
          onPress={() => {
            if (!props.selectedAgentId) return;
            props.onSelectAgent(null);
          }}
        >
          <Text style={shellStyles.headerIcon}>✚</Text>
        </Pressable>
        <Pressable
          style={shellStyles.headerWsBtn}
          onPress={() => setCmdOpen(true)}
        >
          <Text style={shellStyles.headerIcon}>📁</Text>
          <Text style={shellStyles.headerWsText} numberOfLines={1}>
            {props.workspaceActive || "主目录"}
          </Text>
          <Text style={shellStyles.headerCaret}>▾</Text>
        </Pressable>
      </View>

      {/* §7 Stream — chat surface (paseo ChatList + jarvis BubbleView renderer) */}
      <ChatList messages={props.lines as Bubble[]} renderItem={props.renderBubble} />

      {/* §8 Composer — paseo style */}
      <Composer
        value={props.input}
        onChangeText={props.onChangeInput}
        onSubmit={props.onSubmit}
        isDictating={props.recording}
        onToggleDictation={props.onToggleRecording}
        placeholder={props.selectedAgentId ? "接着这个会话说…" : "发消息开始新会话…"}
      />

      {/* LeftSidebar drawer — overlay on mobile, persistent on desktop (future) */}
      {drawerOpen && (
        <>
          <Pressable style={shellStyles.backdrop} onPress={closeDrawer} />
          <Animated.View
            style={[
              shellStyles.drawer,
              { transform: [{ translateX: drawerAnim }] },
            ]}
          >
            <LeftSidebar
              workspaces={toWorkspaces(props.workspaceList)}
              agents={toSidebarAgents(props.agents)}
              selectedAgentId={props.selectedAgentId ?? undefined}
              hostName={props.hostName}
              hostStatus={props.linkUp ? "online" : "offline"}
              onSelectWorkspace={(wsId) => {
                props.onSwitchWorkspace(wsId === "_root" ? "" : wsId);
                closeDrawer();
              }}
              onSelectAgent={(id) => {
                props.onSelectAgent(id);
                closeDrawer();
              }}
              onOpenSettings={() => {
                props.onOpenSettings();
                closeDrawer();
              }}
              onOpenSessions={() => closeDrawer()}
              onNewFolder={() => closeDrawer()}
              onGoHome={() => {
                props.onSwitchWorkspace("");
                closeDrawer();
              }}
            />
          </Animated.View>
        </>
      )}

      {/* Command Center overlay (Cmd+K equivalent — triggered by workspace btn long-press or ⌘ menu) */}
      <CommandCenter
        visible={cmdOpen}
        onClose={() => setCmdOpen(false)}
        commands={[
          {
            id: "ws-root",
            type: "navigate" as const,
            title: "主目录",
            subtitle: "切换到根工作空间",
            icon: "🏠",
            handler: () => {
              props.onSwitchWorkspace("");
              setCmdOpen(false);
            },
          },
          ...props.workspaceList.map((name) => ({
            id: `ws-${name}`,
            type: "navigate" as const,
            title: name,
            subtitle: "工作空间",
            icon: "📁",
            handler: () => {
              props.onSwitchWorkspace(name);
              setCmdOpen(false);
            },
          })),
          {
            id: "agent-new",
            type: "action" as const,
            title: "新会话",
            subtitle: "下条消息创建新 agent",
            icon: "✚",
            handler: () => {
              props.onSelectAgent(null);
              setCmdOpen(false);
            },
          },
          {
            id: "settings-open",
            type: "action" as const,
            title: "设置",
            subtitle: "打开 Settings",
            icon: "⚙️",
            handler: () => {
              props.onOpenSettings();
              setCmdOpen(false);
            },
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const shellStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: SP[3],
    paddingBottom: SP[3],
    gap: SP[2],
    backgroundColor: C.surface0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: RD.xl,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { color: C.fg, fontSize: 18 },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    paddingHorizontal: SP[2],
  },
  statusDot: { width: 8, height: 8, borderRadius: 9999 },
  statusLabel: { fontSize: FS.sm, fontWeight: FW.semibold },
  headerWsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    backgroundColor: C.surface2,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RD.xl,
  },
  headerWsText: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
    flex: 1,
  },
  headerCaret: { color: C.fgSubtle, fontSize: 12 },
  backdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.backdropStrong,
  },
  drawer: {
    position: "absolute",
    top: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: C.surfaceSidebar,
    ...SH.md,
  },
});
