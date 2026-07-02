/**
 * TopBar — screenshots 2.jpg / 3.jpg.
 *
 * 5 interactive elements (left → right):
 *  ☰ hamburger      → opens Drawer (LeftSidebar, 8.jpg)
 *  workspace name ▾  → opens SessionPicker (7.jpg)
 *  model badge       → opens ProviderPicker (3.1.jpg) — chip showing
 *                      current provider + model
 *  📊 status box     → opens AgentStatusPopover (5.jpg) — list of
 *                      running/done/failed agents
 *  ⋯ three-dot       → opens TopMenu (6.jpg)
 *
 * Visible on every screen inside MainScreen (not on LoginScreen).
 * Status bar height is added via paddingTop: 54 (matches legacy hack
 * for edge-to-edge Android).
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useSettingsStore } from "../stores/settings-store";

export function TopBar() {
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const setSessionPickerOpen = useUiStore((s) => s.setSessionPickerOpen);
  const setProviderPickerOpen = useUiStore((s) => s.setProviderPickerOpen);
  const setAgentStatusOpen = useUiStore((s) => s.setAgentStatusOpen);
  const setTopMenuOpen = useUiStore((s) => s.setTopMenuOpen);
  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);
  const settings = useSettingsStore((s) => s.settings);

  const modelLabel = `${settings.defaultProvider} · ${settings.defaultModel[settings.defaultProvider] ?? ""}`;

  return (
    <View style={styles.root}>
      <Pressable onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
        <Text style={styles.icon}>☰</Text>
      </Pressable>

      <Pressable onPress={() => setSessionPickerOpen(true)} style={styles.titleBtn}>
        <Text style={styles.title} numberOfLines={1}>
          {workspaceActive || "Jarvis"}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Pressable onPress={() => setProviderPickerOpen(true)} style={styles.modelBadge}>
        <Text style={styles.modelBadgeText} numberOfLines={1}>{modelLabel}</Text>
      </Pressable>

      <Pressable onPress={() => setAgentStatusOpen(true)} style={styles.iconBtn}>
        <Text style={styles.icon}>▣</Text>
      </Pressable>

      <Pressable onPress={() => setTopMenuOpen(true)} style={styles.iconBtn}>
        <Text style={styles.icon}>⋯</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[2],
    paddingTop: 54, // status bar clearance
    paddingBottom: SP[2],
    gap: SP[1],
    backgroundColor: C.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RD.md,
    backgroundColor: C.surface1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  icon: { color: C.fg, fontSize: 18 },
  titleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    paddingHorizontal: SP[2],
  } as ViewStyle,
  title: {
    color: C.fg,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  chevron: { color: C.fgSubtle, fontSize: 12 },
  modelBadge: {
    backgroundColor: C.accentDim,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: RD.full,
    borderWidth: 1,
    borderColor: C.accent,
    maxWidth: 160,
  } as ViewStyle,
  modelBadgeText: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontWeight: FW.medium,
  },
});
