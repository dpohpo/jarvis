/**
 * ProjectContextMenu — screenshot 8.1.jpg.
 *
 * Visible when ui-store.projectMenuOpen === true. Shown anchored to the
 * ⋯ button on a project row in LeftSidebar.
 *
 * Three options:
 *  Rename  → opens inline input (Phase 14 wires client.agentRename)
 *  Archive → moves project to archived list (Phase 14 wires client.setWorkspaceConfig)
 *  Delete  → Alert.alert confirm → client.deleteAgent (Phase 14 wires)
 *
 * Phase 9 ships the visual + state plumbing; Phase 14 hooks live actions.
 */
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";

export function ProjectContextMenu() {
  // Phase 9: visual + state plumbing only. Hook this to the actual row
  // ⋯ button via ui-store in Phase 14 once agent ops are wired.
  const visible = false;
  const close = () => useUiStore.getState().closeAll();

  return (
    <Popover visible={visible} onClose={close} position={{ top: 200, left: 200 }}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Project</Text>
      </View>
      <Pressable style={styles.row} onPress={close}>
        <Text style={styles.rowText}>✎  Rename</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={close}>
        <Text style={styles.rowText}>📦  Archive</Text>
      </Pressable>
      <Pressable
        style={[styles.row, styles.dangerRow]}
        onPress={() => {
          Alert.alert("Delete project", "Remove this project and all its sessions?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: close },
          ]);
        }}
      >
        <Text style={[styles.rowText, styles.dangerText]}>🗑  Delete</Text>
      </Pressable>
    </Popover>
  );
}

const styles = StyleSheet.create({
  titleWrap: { paddingHorizontal: SP[3], paddingTop: SP[1], paddingBottom: SP[2] },
  title: { color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold, letterSpacing: 1 },
  row: { paddingVertical: SP[2], paddingHorizontal: SP[3], borderRadius: RD.sm },
  rowText: { color: C.fg, fontSize: FS.sm },
  dangerRow: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle },
  dangerText: { color: C.destructive },
});
