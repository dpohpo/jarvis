/**
 * SessionPicker — screenshot 7.jpg.
 *
 * Center sheet opened by tapping the workspace name + ▾ in TopBar.
 * Lists every agent in workspace-store (regardless of workspace) with
 * search filter. Selecting one calls onSelect(id) — Phase 14 will wire
 * that to client.requestAgentHistory(id, 50) + session-store.setAgent(id).
 */
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { CenterSheet } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore, type Agent, type AgentStatus } from "../stores/workspace-store";
import { useSessionStore } from "../stores/session-store";

const DOT: Record<AgentStatus, string> = {
  running: C.statusBusy,
  done: C.statusOnline,
  error: C.statusError,
  needs_input: C.statusBusy,
  attention: C.statusBusy,
  idle: C.fgSubtle,
};

interface Props {
  onSelect: (agentId: string) => void;
}

export function SessionPicker({ onSelect }: Props) {
  const visible = useUiStore((s) => s.sessionPickerOpen);
  const setVisible = useUiStore((s) => s.setSessionPickerOpen);
  const agents = useWorkspaceStore((s) => s.agents);
  const currentAgentId = useSessionStore((s) => s.currentAgentId);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return agents;
    return agents.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        (a.workspace ?? "").toLowerCase().includes(s),
    );
  }, [agents, q]);

  return (
    <CenterSheet visible={visible} onClose={() => setVisible(false)}>
      <Text style={styles.title}>Select session</Text>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search sessions…"
          placeholderTextColor={C.fgSubtle}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        style={{ maxHeight: 400 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item.id);
              setVisible(false);
            }}
            style={[styles.row, currentAgentId === item.id && styles.rowActive]}
          >
            <View style={[styles.dot, { backgroundColor: DOT[item.status] }]} />
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            {item.workspace ? (
              <Text style={styles.rowMeta} numberOfLines={1}>· {item.workspace}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sessions match.</Text>}
      />
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: C.fg, fontSize: FS.base, fontWeight: FW.semibold, textAlign: "center", marginBottom: SP[2] },
  searchWrap: { backgroundColor: C.surface1, borderRadius: RD.lg, paddingHorizontal: SP[3], marginBottom: SP[2] },
  search: { color: C.fg, fontSize: FS.sm, paddingVertical: SP[2] },
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingVertical: SP[2], paddingHorizontal: SP[2], borderRadius: RD.md,
  } as ViewStyle,
  rowActive: { backgroundColor: C.surface2 } as ViewStyle,
  dot: { width: 6, height: 6, borderRadius: 9999 },
  rowTitle: { color: C.fg, fontSize: FS.sm, flex: 1 },
  rowMeta: { color: C.fgSubtle, fontSize: FS.xs },
  empty: { color: C.fgSubtle, fontSize: FS.sm, paddingVertical: SP[3], textAlign: "center" },
});
