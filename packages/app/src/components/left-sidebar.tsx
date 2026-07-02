/**
 * LeftSidebar — 8.jpg pixel-perfect.
 *
 * Sampled:
 *  - sidebar bg #F4F4F4
 *  - host picker row: status dot + name + chevron
 *  - PROJECTS section header: #707070 uppercase 11pt
 *  - project rows: folder icon + name + active row #E0E0E0 fill
 *  - SESSIONS section header
 *  - session rows: status dot + title (#404040)
 *  - footer: 4 icon buttons (#707070 glyphs)
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { ChevronDown, Folder, History, Home, Plus, Settings as SettingsIcon } from "lucide-react-native";
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
}

export function LeftSidebar({ hostName, linkUp, onHome }: Props) {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setSessionPickerOpen = useUiStore((s) => s.setSessionPickerOpen);
  const setAddProjectOpen = useUiStore((s) => s.setAddProjectOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);

  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);
  const workspaceList = useWorkspaceStore((s) => s.workspaceList);
  const agents = useWorkspaceStore((s) => s.agents);
  const setWorkspaceActive = useWorkspaceStore((s) => s.setWorkspaceActive);

  return (
    <View style={styles.root}>
      <View style={styles.hostRow}>
        <View style={[styles.dot, { backgroundColor: linkUp ? C.statusOnline : C.statusIdle }]} />
        <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
        <ChevronDown size={14} color={C.fgSubtle} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SP[3] }}>
        <Text style={styles.sectionHeader}>PROJECTS</Text>
        {workspaceList.length === 0 ? (
          <Text style={styles.emptyHint}>No projects yet</Text>
        ) : (
          workspaceList.map((ws) => (
            <Pressable
              key={ws}
              onPress={() => {
                setWorkspaceActive(ws);
                setDrawerOpen(false);
              }}
              style={[styles.wsRow, workspaceActive === ws && styles.wsRowActive]}
            >
              <Folder size={14} color={C.fgMuted} />
              <Text style={styles.wsName} numberOfLines={1}>{ws}</Text>
            </Pressable>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: SP[4] }]}>SESSIONS</Text>
        {agents.length === 0 ? (
          <Text style={styles.emptyHint}>No sessions yet</Text>
        ) : (
          agents.slice(0, 12).map((a) => <SessionRow key={a.id} agent={a} />)
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.footerBtn}
          onPress={() => { setDrawerOpen(false); setSessionPickerOpen(true); }}
        >
          <History size={18} color={C.fgSubtle} />
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => { setDrawerOpen(false); setAddProjectOpen(true); }}
        >
          <Plus size={18} color={C.fgSubtle} />
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => { setDrawerOpen(false); setSettingsOpen(true); }}
        >
          <SettingsIcon size={18} color={C.fgSubtle} />
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => { setDrawerOpen(false); onHome(); }}>
          <Home size={18} color={C.fgSubtle} />
        </Pressable>
      </View>

      <ProjectContextMenu />
    </View>
  );
}

function SessionRow({ agent }: { agent: Agent }) {
  return (
    <Pressable style={styles.agentRow}>
      <View style={[styles.agentDot, { backgroundColor: STATUS_DOT[agent.status] }]} />
      <Text style={styles.agentTitle} numberOfLines={1}>{agent.title}</Text>
    </Pressable>
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
  emptyHint: {
    color: C.fgSubtle, fontSize: FS.xs,
    paddingHorizontal: SP[3], paddingVertical: SP[1],
  },
  wsRow: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingHorizontal: SP[3], paddingVertical: SP[2],
    marginHorizontal: SP[2], borderRadius: RD.md,
  } as ViewStyle,
  wsRowActive: { backgroundColor: C.surface3 } as ViewStyle, // #E0E0E0
  wsName: { color: C.fg, fontSize: FS.sm, flex: 1 },
  agentRow: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingHorizontal: SP[3], paddingVertical: SP[2],
    marginHorizontal: SP[2], borderRadius: RD.md,
  } as ViewStyle,
  agentDot: { width: 6, height: 6, borderRadius: 9999 } as ViewStyle,
  agentTitle: { color: C.fgMuted, fontSize: FS.sm, flex: 1 },
  footer: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.borderSubtle,
    paddingTop: SP[2], paddingHorizontal: SP[2],
    gap: SP[1],
  } as ViewStyle,
  footerBtn: { width: 38, height: 38, borderRadius: RD.md, alignItems: "center", justifyContent: "center" } as ViewStyle,
});
