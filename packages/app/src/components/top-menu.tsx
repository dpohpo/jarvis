/**
 * TopMenu — 6.jpg three-dot menu.
 * Settings / Reload workspace / Sign out (red).
 */
import { Alert, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Settings as SettingsIcon, RotateCw, LogOut } from "lucide-react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { clearState } from "../store";

export function TopMenu() {
  const visible = useUiStore((s) => s.topMenuOpen);
  const setVisible = useUiStore((s) => s.setTopMenuOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <Popover visible={visible} onClose={() => setVisible(false)} position={{ top: 100, right: 12 }}>
      <Pressable
        style={styles.row}
        onPress={() => { setVisible(false); setSettingsOpen(true); }}
      >
        <SettingsIcon size={14} color={C.fg} />
        <Text style={styles.rowText}>Settings</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => setVisible(false)}>
        <RotateCw size={14} color={C.fg} />
        <Text style={styles.rowText}>Reload workspace</Text>
      </Pressable>
      <Pressable
        style={[styles.row, styles.dangerRow]}
        onPress={() => {
          Alert.alert("Sign out", "Wipe pairing and return to login?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: () => { void clearState().then(() => setVisible(false)); },
            },
          ]);
        }}
      >
        <LogOut size={14} color={C.destructive} />
        <Text style={[styles.rowText, styles.dangerText]}>Sign out</Text>
      </Pressable>
    </Popover>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingVertical: SP[2], paddingHorizontal: SP[3], borderRadius: RD.sm,
  } as ViewStyle,
  rowText: { color: C.fg, fontSize: FS.sm },
  dangerRow: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle },
  dangerText: { color: C.destructive },
});
