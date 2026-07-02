/**
 * AgentStatusPopover — screenshot 5.jpg.
 *
 * Top-bar 📊 box tap shows this popover listing every agent grouped by
 * status. Tapping an agent row (screenshot 5。1.jpg) will deep-link to
 * that agent's chat — Phase 14 wires the navigation once the chat-surface
 * navigation is in.
 *
 * Visible when ui-store.agentStatusOpen === true.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore, type Agent, type AgentStatus } from "../stores/workspace-store";

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: C.statusBusy,
  done: C.statusOnline,
  error: C.statusError,
  needs_input: C.statusBusy,
  attention: C.statusBusy,
  idle: C.fgSubtle,
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  running: "Running",
  done: "Done",
  error: "Failed",
  needs_input: "Needs input",
  attention: "Needs attention",
  idle: "Idle",
};

export function AgentStatusPopover() {
  const visible = useUiStore((s) => s.agentStatusOpen);
  const close = useUiStore((s) => s.setAgentStatusOpen);
  const agents = useWorkspaceStore((s) => s.agents);

  const grouped: Record<AgentStatus, Agent[]> = {
    running: [], done: [], error: [], needs_input: [], attention: [], idle: [],
  };
  for (const a of agents) grouped[a.status].push(a);
  const order: AgentStatus[] = ["running", "needs_input", "attention", "error", "done", "idle"];

  return (
    <Popover visible={visible} onClose={() => close(false)} position={{ top: 100, right: 12 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agent status</Text>
        <Text style={styles.headerCount}>{agents.length}</Text>
      </View>
      <ScrollView style={{ maxHeight: 360 }}>
        {agents.length === 0 ? (
          <Text style={styles.empty}>No agents yet</Text>
        ) : (
          order
            .filter((s) => grouped[s].length > 0)
            .map((s) => (
              <View key={s} style={styles.group}>
                <Text style={styles.groupHeader}>{STATUS_LABELS[s]} · {grouped[s].length}</Text>
                {grouped[s].map((a) => (
                  <Pressable key={a.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: STATUS_COLORS[s] }]} />
                    <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                    {a.workspace ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>· {a.workspace}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </Popover>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerTitle: { color: C.fg, fontSize: FS.sm, fontWeight: FW.semibold },
  headerCount: { color: C.fgSubtle, fontSize: FS.xs },
  empty: { color: C.fgSubtle, fontSize: FS.sm, paddingVertical: SP[2] },
  group: { marginBottom: SP[2] },
  groupHeader: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: 1, marginBottom: 4,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingVertical: 6, paddingHorizontal: 4, borderRadius: RD.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 9999 },
  rowTitle: { color: C.fg, fontSize: FS.sm, flex: 1 },
  rowMeta: { color: C.fgSubtle, fontSize: FS.xs },
});
