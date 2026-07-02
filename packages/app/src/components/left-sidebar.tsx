/**
 * LeftSidebar — screenshot 8.jpg.
 *
 * Drawer content. Visible when ui-store.drawerOpen === true.
 *
 * Layout (top → bottom):
 *  Host picker      — status dot (linkUp color) + host name + ▾
 *  PROJECTS header  — uppercase, subtle text
 *  Project rows     — folder icon + name + (active row has surface1 fill)
 *                     each row has trailing ⋯ button (8.1.jpg)
 *  SESSIONS header
 *  Session rows     — status dot + title
 *  Footer           — 4 icon buttons (Sessions / New / Settings / Home)
 *
 * Host name comes from PhoneState.daemonDeviceId (passed via prop).
 * Workspace/agent lists come from workspace-store (Phase 14 fills them
 * with live data; for now they render empty-state hints).
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
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
  idle: C.fgSubtle,
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
  const setAgent = useWorkspaceStore((s) => s); // for actions we need store actions
  void setAgent; // placeholder until Phase 14 wires setCurrentAgent action

  return (
    <View style={styles.root}>
      {/* Host picker */}
      <View style={styles.hostRow}>
        <View style={[styles.dot, { backgroundColor: linkUp ? C.statusOnline : C.fgSubtle }]} />
        <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
        <Text style={styles.hostChevron}>▾</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SP[3] }}>
        {/* Projects */}
        <Text style={styles.sectionHeader}>PROJECTS</Text>
        {workspaceList.length === 0 ? (
          <Text style={styles.emptyHint}>No projects yet</Text>
        ) : (
          workspaceList.map((ws) => (
            <ProjectRow
              key={ws}
              name={ws}
              active={workspaceActive === ws}
              onPress={() => {
                setWorkspaceActive(ws);
                setDrawerOpen(false);
              }}
            />
          ))
        )}

        {/* Sessions */}
        <Text style={[styles.sectionHeader, { marginTop: SP[4] }]}>SESSIONS</Text>
        {agents.length === 0 ? (
          <Text style={styles.emptyHint}>No sessions yet</Text>
        ) : (
          agents.slice(0, 12).map((a) => <SessionRow key={a.id} agent={a} />)
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.footerBtn}
          onPress={() => {
            setDrawerOpen(false);
            setSessionPickerOpen(true);
          }}
        >
          <Text style={styles.footerIcon}>⏱</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => {
            setDrawerOpen(false);
            setAddProjectOpen(true);
          }}
        >
          <Text style={styles.footerIcon}>＋</Text>
        </Pressable>
        <Pressable
          style={styles.footerBtn}
          onPress={() => {
            setDrawerOpen(false);
            setSettingsOpen(true);
          }}
        >
          <Text style={styles.footerIcon}>⚙</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => { setDrawerOpen(false); onHome(); }}>
          <Text style={styles.footerIcon}>⌂</Text>
        </Pressable>
      </View>

      <ProjectContextMenu />
    </View>
  );
}

function ProjectRow({ name, active, onPress }: { name: string; active: boolean; onPress: () => void }) {
  const setProjectMenuTarget = useUiStore((s) => s.setAgentStatusOpen); // unused; placeholder
  void setProjectMenuTarget;
  return (
    <View style={[styles.wsRow, active && styles.wsRowActive]}>
      <Pressable onPress={onPress} style={styles.wsRowPress}>
        <Text style={styles.wsIcon}>📁</Text>
        <Text style={styles.wsName} numberOfLines={1}>{name}</Text>
      </Pressable>
      <Pressable style={styles.wsMoreBtn}>
        <Text style={styles.wsMore}>⋯</Text>
      </Pressable>
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
  root: { flex: 1, backgroundColor: C.surfaceSidebar },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    gap: SP[2],
    marginBottom: SP[2],
  } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 9999 },
  hostName: { color: C.fg, fontSize: FS.sm, fontWeight: FW.semibold, flex: 1 },
  hostChevron: { color: C.fgSubtle, fontSize: 12 },
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
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SP[2], borderRadius: RD.md,
    paddingRight: SP[1],
  } as ViewStyle,
  wsRowActive: { backgroundColor: C.surface1 },
  wsRowPress: {
    flex: 1,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SP[2], paddingVertical: SP[2], gap: SP[2],
  } as ViewStyle,
  wsIcon: { fontSize: 14 },
  wsName: { color: C.fg, fontSize: FS.sm, flex: 1 },
  wsMoreBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: RD.sm },
  wsMore: { color: C.fgSubtle, fontSize: 16 },
  agentRow: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingHorizontal: SP[3], paddingVertical: SP[2],
    marginHorizontal: SP[2], borderRadius: RD.md,
  } as ViewStyle,
  agentDot: { width: 6, height: 6, borderRadius: 9999 },
  agentTitle: { color: C.fgMuted, fontSize: FS.sm, flex: 1 },
  footer: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.borderSubtle,
    paddingTop: SP[2],
    paddingHorizontal: SP[2],
    gap: SP[1],
  } as ViewStyle,
  footerBtn: {
    width: 38, height: 38, borderRadius: RD.md,
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,
  footerIcon: { color: C.fgMuted, fontSize: 16 },
});
