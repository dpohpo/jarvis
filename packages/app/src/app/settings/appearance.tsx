/**
 * Appearance section — theme picker + font scale.
 *
 * Phase 13 wires the 3 options from the screenshots (dark / light /
 * system). Font scale slider lets users tune 0.85x — 1.3x.
 */
import { ScrollView, StyleSheet, Text, View, ViewStyle, Pressable } from "react-native";
import { C, FS, FW, RD, SP, LS } from "../../theme";
import { useSettingsStore, type ThemeName } from "../../stores/settings-store";

const THEMES: { id: ThemeName; label: string; preview: string }[] = [
  { id: "dark", label: "Dark", preview: "#1A1A1F" },
  { id: "light", label: "Light", preview: "#FAFAFA" },
  { id: "system", label: "System", preview: "linear" },
];

export function Appearance() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  return (
    <ScrollView contentContainerStyle={{ padding: SP[3] }}>
      <Text style={styles.label}>THEME</Text>
      <View style={styles.themeRow}>
        {THEMES.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.themeCard, settings.theme === t.id && styles.themeCardActive]}
            onPress={() => patch({ theme: t.id })}
          >
            <View style={[styles.themeSwatch, { backgroundColor: t.preview === "linear" ? C.surface3 : t.preview }]} />
            <Text style={[styles.themeLabel, settings.theme === t.id && styles.themeLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>FONT SCALE ({settings.fontScale.toFixed(2)}x)</Text>
      <View style={styles.scaleRow}>
        {[0.85, 0.95, 1.0, 1.1, 1.25].map((s) => (
          <Pressable
            key={s}
            style={[styles.scaleChip, Math.abs(settings.fontScale - s) < 0.01 && styles.scaleChipActive]}
            onPress={() => patch({ fontScale: s })}
          >
            <Text style={[styles.scaleChipText, Math.abs(settings.fontScale - s) < 0.01 && styles.scaleChipTextActive]}>
              {s.toFixed(2)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, marginTop: SP[3], marginBottom: SP[2],
  },
  themeRow: { flexDirection: "row", gap: SP[2] } as ViewStyle,
  themeCard: {
    flex: 1,
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    padding: SP[2],
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  } as ViewStyle,
  themeCardActive: { borderColor: C.accent } as ViewStyle,
  themeSwatch: { width: "100%", height: 56, borderRadius: RD.md, marginBottom: SP[1] },
  themeLabel: { color: C.fgMuted, fontSize: FS.sm },
  themeLabelActive: { color: C.accentHover, fontWeight: FW.semibold },
  scaleRow: { flexDirection: "row", flexWrap: "wrap", gap: SP[1] } as ViewStyle,
  scaleChip: {
    paddingHorizontal: SP[3], paddingVertical: SP[1],
    borderRadius: 9999, backgroundColor: C.surface1,
    borderWidth: 1, borderColor: C.borderSubtle,
  } as ViewStyle,
  scaleChipActive: { backgroundColor: C.accentDim, borderColor: C.accent } as ViewStyle,
  scaleChipText: { color: C.fgMuted, fontSize: FS.xs },
  scaleChipTextActive: { color: C.accentHover, fontWeight: FW.semibold },
});
