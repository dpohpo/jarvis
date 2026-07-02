/**
 * ProjectContextMenu — 8.1.jpg.
 *
 * Rename / Archive / Delete. Wired to useJarvis.renameAgent / deleteAgent
 * by the parent (LeftSidebar) via onRename / onDelete props.
 */
import { Alert, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pencil, Archive, Trash2 } from "lucide-react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, RD, SP } from "../theme";

export interface ProjectContextMenuProps {
  visible: boolean;
  projectName: string;
  position: { top: number; left: number };
  onClose: () => void;
  onRename?: (oldName: string, newName: string) => void;
  onArchive?: (name: string) => void;
  onDelete?: (name: string) => void;
}

export function ProjectContextMenu({
  visible,
  projectName,
  position,
  onClose,
  onRename,
  onArchive,
  onDelete,
}: ProjectContextMenuProps) {
  const triggerRename = () => {
    onClose();
    // Native prompt — Alert.prompt is iOS-only; we use a simple Alert with
    // a callback. Caller can swap for an inline TextInput-based dialog.
    Alert.alert(
      "Rename project",
      `Rename "${projectName}" to:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename",
          onPress: (newName?: string) => {
            if (newName && newName !== projectName) onRename?.(projectName, newName);
          },
        },
      ],
      { cancelable: true },
    );
  };

  const triggerArchive = () => {
    onClose();
    onArchive?.(projectName);
  };

  const triggerDelete = () => {
    onClose();
    Alert.alert(
      "Delete project",
      `Remove "${projectName}" and all its sessions?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete?.(projectName) },
      ],
    );
  };

  return (
    <Popover visible={visible} onClose={onClose} position={position}>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{projectName}</Text>
      </View>
      <Pressable style={styles.row} onPress={triggerRename}>
        <Pencil size={14} color={C.fg} />
        <Text style={styles.rowText}>Rename</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={triggerArchive}>
        <Archive size={14} color={C.fg} />
        <Text style={styles.rowText}>Archive</Text>
      </Pressable>
      <Pressable style={[styles.row, styles.dangerRow]} onPress={triggerDelete}>
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
