/**
 * EmptyMain — screenshot 2.jpg body.
 *
 * Shown inside MainScreen when workspace-store.workspaceList is empty
 * (no projects created yet on this host). When projects exist, Phase 11
 * ChatSurface takes over this slot.
 *
 * Layout (centered, generous breathing room):
 *  80x80 circular icon (surface1 fill, 📂 emoji)
 *  "Welcome to {workspace}" title (lg / semibold / fg)
 *  "You don't have any projects yet" subtitle (sm / fgMuted)
 *  64x64 circular + button (C.accent fill, accentForeground +) → opens
 *  AddProject sheet (2.1.jpg)
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP, SHADOWS } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore } from "../stores/workspace-store";

export function EmptyMain() {
  const setAddProjectOpen = useUiStore((s) => s.setAddProjectOpen);
  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);
  const name = workspaceActive || "Jarvis";

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📂</Text>
      </View>
      <Text style={styles.title}>Welcome to {name}</Text>
      <Text style={styles.subtitle}>You don't have any projects yet</Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={() => setAddProjectOpen(true)}
        accessibilityLabel="Add a project"
        accessibilityRole="button"
      >
        <Text style={styles.addBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  } as ViewStyle,
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: RD.full,
    backgroundColor: C.surface1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[5],
  } as ViewStyle,
  icon: { fontSize: 40 },
  title: {
    color: C.fg,
    fontSize: FS.lg,
    fontWeight: FW.semibold,
    marginBottom: SP[1],
  },
  subtitle: {
    color: C.fgMuted,
    fontSize: FS.sm,
    marginBottom: SP[6],
  },
  addBtn: {
    width: 64,
    height: 64,
    borderRadius: RD.full,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.md,
  } as ViewStyle,
  addBtnPressed: { backgroundColor: C.accentBright } as ViewStyle,
  addBtnText: {
    color: C.accentForeground,
    fontSize: 32,
    fontWeight: FW.bold,
    marginTop: -2, // optical center
  },
});
