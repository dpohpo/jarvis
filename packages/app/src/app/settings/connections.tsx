/**
 * Connections section — host management.
 *
 * Lists recentHosts from settings-store + a "Pair new host" CTA that
 * flips back to LoginScreen via ui-store (Phase 15 will properly
 * support multi-host relay). Tapping a host sets it active.
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP, LS } from "../../theme";
import { useSettingsStore } from "../../stores/settings-store";

export function Connections() {
  const hosts = useSettingsStore((s) => s.settings.recentHosts);
  return (
    <ScrollView contentContainerStyle={{ padding: SP[3] }}>
      <Text style={styles.label}>PAIRED HOSTS</Text>
      {hosts.length === 0 ? (
        <Text style={styles.empty}>Only the current host is paired. Multi-host lands in Phase 15.</Text>
      ) : (
        hosts.map((h) => (
          <View key={h} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.rowText}>{h}</Text>
          </View>
        ))
      )}
      <Pressable style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Pair another host</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, marginBottom: SP[2],
  },
  empty: { color: C.fgSubtle, fontSize: FS.sm, lineHeight: 22 },
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    backgroundColor: C.surface1, borderRadius: RD.md,
    paddingHorizontal: SP[3], paddingVertical: SP[2], marginBottom: SP[1],
  } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: C.statusOnline },
  rowText: { color: C.fg, fontSize: FS.sm, flex: 1 },
  addBtn: {
    backgroundColor: C.accent,
    borderRadius: RD.lg,
    paddingVertical: SP[3],
    alignItems: "center",
    marginTop: SP[4],
  } as ViewStyle,
  addBtnText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },
});
