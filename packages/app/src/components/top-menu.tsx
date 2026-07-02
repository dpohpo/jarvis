/**
 * TopMenu — screenshot 6.jpg.
 *
 * Top-bar ⋯ tap shows this 3-item menu: Settings / Reload workspace /
 * Sign out.
 *
 * Phase 13 will add the Settings navigation; for now "Settings" toggles
 * ui-store.settingsOpen. Sign out wipes PhoneState (long-press in the
 * legacy console header also does this).
 */
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
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
        onPress={() => {
          setVisible(false);
          setSettingsOpen(true);
        }}
      >
        <Text style={styles.rowText}>⚙  Settings</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => setVisible(false)}>
        <Text style={styles.rowText}>⟳  Reload workspace</Text>
      </Pressable>
      <Pressable
        style={[styles.row, styles.dangerRow]}
        onPress={() => {
          Alert.alert("Sign out", "Wipe pairing and return to login?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: () => {
                void clearState().then(() => setVisible(false));
              },
            },
          ]);
        }}
      >
        <Text style={[styles.rowText, styles.dangerText]}>⏻  Sign out</Text>
      </Pressable>
    </Popover>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    borderRadius: RD.sm,
  },
  rowText: { color: C.fg, fontSize: FS.sm, fontWeight: FW.regular },
  dangerRow: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle },
  dangerText: { color: C.destructive },
});
