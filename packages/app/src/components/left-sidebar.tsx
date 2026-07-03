/**
 * LeftSidebar — tree structure: Workspace (folder) → Sessions.
 *
 * 8.jpg layout with hierarchy:
 *   - Each workspace is a collapsible folder
 *   - Inside: its sessions (clickable, restores chat)
 *   - Workspace row: ⋯ menu (rename/delete) + ➕ add session
 *   - Session row: ⋯ menu (rename/delete)
 *   - Click session → selectAgent(id) → restores chat from AsyncStorage
 */
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type LayoutChangeEvent,
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  History,
  Home,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Pencil,
} from "lucide-react-native";
import { C, FS, FW, RD, SP, LS } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore, type Agent, type AgentStatus } from "../stores/workspace-store";
import { ProjectContextMenu } from "./project-context-menu";

const STATUS_DOT: Record<AgentStatus, string> = {
  running: C.statusBusy,
  done: C.statusOnline,
  error: C.statusError,
  needs_input: C.statusBusy,
  attention: C.statusBusy,
  idle: C.statusIdle,
};

interface Props {
  hostName: string;
  linkUp: boolean;
  onHome: () => void;
  onSelectAgent?: (id: string) => void;
  onRenameWorkspace?: (oldName: string, newName: string) => void;
  onDeleteWorkspace?: (name: string) => void;
  onAddSession?: (workspace: string) => void;
  onRenameAgent?: (id: string, newName: string) => void;
  onDeleteAgent?: (id: string) => void;
}

export function LeftSidebar({
  hostName, linkUp, onHome, onSelectAgent,
  onRenameWorkspace, onDeleteWorkspace,
  onAddSession, onRenameAgent, onDeleteAgent,
}: Props) {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setSessionPickerOpen = useUiStore((s) => s.setSessionPickerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);

  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);
  const workspaceList = useWorkspaceStore((s) => s.workspaceList);
  const agents = useWorkspaceStore((s) => s.agents);
  const setWorkspaceActive = useWorkspaceStore((s) => s.setWorkspaceActive);

  const [expanded, setExpanded] = useState<Set<string>>(new Set([workspaceActive]));
  const [menuFor, setMenuFor] = useState<{ type: "workspace" | "agent"; id: string; name: string } | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 200, left: 180 });

  const toggleExpand = (ws: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ws)) next.delete(ws);
      else next.add(ws);
      return next;
    });
  };

  const openMenu = (type: "workspace" | "agent", id: string, name: string, y: number) => {
    setMenuPos({ top: y + 40, left: 180 });
    setMenuFor({ type, id, name });
  };

  return (
    <View style={styles.root}>
      {/* Host picker */}
      <View style={styles.hostRow}>
        <View style={[styles.dot, { backgroundColor: linkUp ? C.statusOnline : C.statusIdle }]} />
        <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
        <ChevronDown size={14} color={C.fgSubtle} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SP[3] }}>
        <Text style={styles.sectionHeader}>WORKSPACES</Text>
        {workspaceList.length === 0 ? (
          <Text style={styles.emptyHint}>No workspaces yet</Text>
        ) : (
          workspaceList.map((ws) => {
            const wsAgents = agents.filter((a) => a.workspace === ws);
            const isOpen = expanded.has(ws);
            return (
              <View key={ws}>
                {/* Workspace row (folder) */}
                <View style={styles.wsRowWrap}>
                  <Pressable
                    style={[styles.wsRow, workspaceActive === ws && styles.wsRowActive]}
                    onPress={() => { setWorkspaceActive(ws); toggleExpand(ws); }}
                  >
                    {isOpen ? <FolderOpen size={14} color={C.fgMuted} /> : <Folder size={14} color={C.fgMuted} />}
                    <Text style={styles.wsName} numberOfLines={1}>{ws}</Text>
                    {isOpen ? <ChevronDown size={12} color={C.fgSubtle} /> : <ChevronRight size={12} color={C.fgSubtle} />}
                  </Pressable>
                  <Pressable
                    style={styles.wsMoreBtn}
                    onPress={(e) => {
                      const target = e.currentTarget as any;
                      openMenu("workspace", ws, ws, wsAgents.length * 36 + 80);
                    }}
                    hitSlop={4}
                  >
                    <MoreHorizontal size={14} color={C.fgSubtle} />
                  </Pressable>
                </View>

                {/* Sessions inside workspace */}
                {isOpen && (
                  <View style={styles.sessionList}>
                    {wsAgents.length === 0 ? (
                      <Text style={styles.sessionEmpty}>No sessions</Text>
                    ) : (
                      wsAgents.map((a) => (
                        <View key={a.id} style={styles.sessionRowWrap}>
                          <Pressable
                            style={styles.sessionRow}
                            onPress={() => { onSelectAgent?.(a.id); setDrawerOpen(false); }}
                          >
                            <MessageSquare size={12} color={C.fgSubtle} />
                            <View style={[styles.sessionDot, { backgroundColor: STATUS_DOT[a.status] }]} />
                            <Text style={styles.sessionTitle} numberOfLines={1}>{a.title}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.sessionMoreBtn}
                            onPress={(e) => openMenu("agent", a.id, a.title, 0)}
                            hitSlop={4}
                          >
                            <MoreHorizontal size={12} color={C.fgSubtle} />
                          </Pressable>
                        </View>
                      ))
                    )}
                    {/* Add session button */}
                    <Pressable
                      style={styles.addSessionBtn}
                      onPress={() => { onAddSession?.(ws); }}
                    >
                      <Plus size={12} color={C.fgSubtle} />
                      <Text style={styles.addSessionText}>New session</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Unassigned sessions (no workspace) */}
        {agents.filter((a) => !a.workspace).length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { marginTop: SP[4] }]}>UNSORTED</Text>
            {agents.filter((a) => !a.workspace).map((a) => (
              <View key={a.id} style={styles.sessionRowWrap}>
                <Pressable
                  style={styles.sessionRow}
                  onPress={() => { onSelectAgent?.(a.id); setDrawerOpen(false); }}
                >
                  <MessageSquare size={12} color={C.fgSubtle} />
                  <View style={[styles.sessionDot, { backgroundColor: STATUS_DOT[a.status] }]} />
                  <Text style={styles.sessionTitle} numberOfLines={1}>{a.title}</Text>
                </Pressable>
                <Pressable style={styles.sessionMoreBtn} onPress={() => openMenu("agent", a.id, a.title, 0)} hitSlop={4}>
                  <MoreHorizontal size={12} color={C.fgSubtle} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={() => { setDrawerOpen(false); setSessionPickerOpen(true); }}>
          <History size={18} color={C.fgSubtle} />
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => { setDrawerOpen(false); setSettingsOpen(true); }}>
          <SettingsIcon size={18} color={C.fgSubtle} />
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => { setDrawerOpen(false); onHome(); }}>
          <Home size={18} color={C.fgSubtle} />
        </Pressable>
      </View>

      {/* Context menu for workspace or agent */}
      {menuFor && (
        <Pressable
          style={{ position: "absolute", top: menuPos.top, left: menuPos.left, right: 12, zIndex: 100 }}
          onPress={() => setMenuFor(null)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle} numberOfLines={1}>{menuFor.name}</Text>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                const newName = prompt("Rename to:", menuFor.name);
                if (newName && newName !== menuFor.name) {
                  if (menuFor.type === "workspace") onRenameWorkspace?.(menuFor.id, newName);
                  else onRenameAgent?.(menuFor.id, newName);
                }
                setMenuFor(null);
              }}
            >
              <Pencil size={14} color={C.fg} />
              <Text style={styles.menuRowText}>Rename</Text>
            </Pressable>
            <Pressable
              style={[styles.menuRow, styles.menuDanger]}
              onPress={() => {
                if (confirm(`Delete "${menuFor.name}"?`)) {
                  if (menuFor.type === "workspace") onDeleteWorkspace?.(menuFor.id);
                  else onDeleteAgent?.(menuFor.id);
                }
                setMenuFor(null);
              }}
            >
              <Trash2 size={14} color={C.destructive} />
              <Text style={[styles.menuRowText, { color: C.destructive }]}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surfaceSidebar } as ViewStyle,
  hostRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SP[3], paddingVertical: SP[2],
    gap: SP[2], marginBottom: SP[2],
  } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 9999 } as ViewStyle,
  hostName: { color: C.fg, fontSize: FS.sm, fontWeight: FW.semibold, flex: 1 },
  scroll: { flex: 1 },
  sectionHeader: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, paddingHorizontal: SP[3], paddingVertical: SP[2],
  },
  emptyHint: { color: C.fgSubtle, fontSize: FS.xs, paddingHorizontal: SP[3], paddingVertical: SP[1] },
  wsRowWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SP[2], borderRadius: RD.md,
  } as ViewStyle,
  wsRow: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingHorizontal: SP[3], paddingVertical: SP[2],
    borderRadius: RD.md, flex: 1,
  } as ViewStyle,
  wsRowActive: { backgroundColor: C.surface3 } as ViewStyle,
  wsMoreBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: RD.sm } as ViewStyle,
  wsName: { color: C.fg, fontSize: FS.sm, flex: 1 },
  sessionList: { marginLeft: SP[4] },
  sessionEmpty: { color: C.fgSubtle, fontSize: FS.xs, paddingVertical: SP[1], paddingHorizontal: SP[3] },
  sessionRowWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: SP[2], borderRadius: RD.md } as ViewStyle,
  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: SP[1],
    paddingHorizontal: SP[3], paddingVertical: SP[2], borderRadius: RD.md, flex: 1,
  } as ViewStyle,
  sessionMoreBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: RD.sm } as ViewStyle,
  sessionDot: { width: 5, height: 5, borderRadius: 9999 } as ViewStyle,
  sessionTitle: { color: C.fgMuted, fontSize: FS.sm, flex: 1 },
  addSessionBtn: {
    flexDirection: "row", alignItems: "center", gap: SP[1],
    paddingHorizontal: SP[3], paddingVertical: SP[1], marginTop: 2,
  } as ViewStyle,
  addSessionText: { color: C.fgSubtle, fontSize: FS.xs },
  footer: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle,
    paddingTop: SP[2], paddingHorizontal: SP[2], gap: SP[1],
  } as ViewStyle,
  footerBtn: { width: 38, height: 38, borderRadius: RD.md, alignItems: "center", justifyContent: "center" } as ViewStyle,
  menuCard: {
    backgroundColor: C.surface3, borderRadius: RD.lg, padding: SP[1],
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  } as ViewStyle,
  menuTitle: { color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold, paddingHorizontal: SP[2], paddingVertical: SP[1] },
  menuRow: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingVertical: SP[2], paddingHorizontal: SP[2], borderRadius: RD.sm,
  } as ViewStyle,
  menuRowText: { color: C.fg, fontSize: FS.sm },
  menuDanger: { marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle },
});
