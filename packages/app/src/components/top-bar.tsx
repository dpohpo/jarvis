/**
 * TopBar — 2.jpg / 3.jpg top bar, pixel-perfect.
 *
 * 5 elements (left → right):
 *   Menu (hamburger)         → open Drawer
 *   workspace name + chevron → open SessionPicker
 *   status box icon          → open AgentStatusPopover (5.jpg)
 *   MoreVertical (⋯)         → open TopMenu (6.jpg)
 *
 * (model badge from 3.jpg is omitted until screenshot clarity improves —
 * sampling couldn't pick out a badge region with enough non-bg pixels.)
 *
 * All glyphs are lucide-react-native (NOT emoji).
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Menu, ChevronDown, Square, MoreVertical } from "lucide-react-native";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore } from "../stores/workspace-store";

export function TopBar() {
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const setSessionPickerOpen = useUiStore((s) => s.setSessionPickerOpen);
  const setAgentStatusOpen = useUiStore((s) => s.setAgentStatusOpen);
  const setTopMenuOpen = useUiStore((s) => s.setTopMenuOpen);
  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);

  return (
    <View style={styles.root}>
      <Pressable onPress={() => setDrawerOpen(true)} style={styles.iconBtn} hitSlop={8}>
        <Menu size={20} color={C.fg} />
      </Pressable>

      <Pressable onPress={() => setSessionPickerOpen(true)} style={styles.titleBtn} hitSlop={4}>
        <Text style={styles.title} numberOfLines={1}>
          {workspaceActive || "Paseo"}
        </Text>
        <ChevronDown size={14} color={C.fgSubtle} />
      </Pressable>

      <Pressable onPress={() => setAgentStatusOpen(true)} style={styles.iconBtn} hitSlop={8}>
        <Square size={18} color={C.fg} />
      </Pressable>

      <Pressable onPress={() => setTopMenuOpen(true)} style={styles.iconBtn} hitSlop={8}>
        <MoreVertical size={20} color={C.fg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[2],
    paddingTop: 54,
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
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
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
});
