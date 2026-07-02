/**
 * EmptyMain — 2.jpg body (no projects yet).
 *
 * Sampled:
 *  - folder icon in a soft circular tint (#F4F4F4 fill)
 *  - "Welcome to {workspace}" #181818 ~17pt semibold
 *  - "You don't have any projects yet" #707070 13pt
 *  - large circular + button — BLACK (#101010) fill + white + glyph
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { FolderOpen, Plus } from "lucide-react-native";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore } from "../stores/workspace-store";

export function EmptyMain() {
  const setAddProjectOpen = useUiStore((s) => s.setAddProjectOpen);
  const workspaceActive = useWorkspaceStore((s) => s.workspaceActive);
  const name = workspaceActive || "Paseo";

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <FolderOpen size={36} color={C.fgSubtle} />
      </View>
      <Text style={styles.title}>Welcome to {name}</Text>
      <Text style={styles.subtitle}>You don't have any projects yet</Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={() => setAddProjectOpen(true)}
        accessibilityLabel="Add a project"
        accessibilityRole="button"
      >
        <Plus size={28} color={C.btnPrimaryFg} strokeWidth={2.5} />
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
    backgroundColor: C.bg,
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
  title: {
    color: C.fg,
    fontSize: FS.lg,
    fontWeight: FW.semibold,
    marginBottom: SP[1],
  },
  subtitle: {
    color: C.fgSubtle,
    fontSize: FS.sm,
    marginBottom: SP[6],
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: RD.full,
    backgroundColor: C.btnPrimary, // BLACK
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  addBtnPressed: { backgroundColor: C.btnPrimaryHover } as ViewStyle,
});
