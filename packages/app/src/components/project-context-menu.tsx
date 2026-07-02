/**
 * ProjectContextMenu — 8.1.jpg.
 */
import { Alert, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Pencil, Archive, Trash2 } from "lucide-react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";

export function ProjectContextMenu() {
  // Phase 9 ships visual; Phase 14 binds to ⋯ button on project rows.
  const visible = false;
  const close = () => useUiStore.getState().closeAll();

  return (
    <Popover visible={visible} onClose={close} position={{ top: 200, left: 200 }}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Project</Text>
      </View>
      <Pressable style={styles.row} onPress={close}>
        <Pencil size={14} color={C.fg} />
        <Text style={styles.rowText}>Rename</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={close}>
        <Archive size={14} color={C.fg} />
        <Text style={styles.rowText}>Archive</Text>
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
        <Trash2 size={14} color={C.destructive} />
        <Text style={[styles.rowText, styles.dangerText]}>Delete</Text>
      </Pressable>
    </Popover>
  );
}

const styles = StyleSheet.create({
  titleWrap: { paddingHorizontal: SP[3], paddingTop: SP[1], paddingBottom: SP[2] },
  title: { color: C.fgSubtle, fontSize: FS.xs, fontWeight: "600", letterSpacing: 1 },
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingVertical: SP[2], paddingHorizontal: SP[3], borderRadius: RD.sm,
  } as ViewStyle,
  rowText: { color: C.fg, fontSize: FS.sm },
  dangerRow: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle },
  dangerText: { color: C.destructive },
});
