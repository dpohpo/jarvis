/**
 * ProviderPicker — screenshot 3.1.jpg.
 *
 * Bottom sheet opened by tapping the model badge in TopBar. Three
 * sections:
 *  Provider — 4 round icon buttons (Claude / Codex / Copilot / Gemini),
 *             selected has C.accent border
 *  Model    — chips with the per-provider model list (selecting updates
 *             settings.defaultModel[provider])
 *  Mode     — 3-way segmented control (Plan / Code / Ask)
 *
 * Apply button writes the selection to settings-store and closes.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { BottomSheet } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useSettingsStore, type Provider, type Mode } from "../stores/settings-store";

const PROVIDERS: { id: Provider; label: string; glyph: string }[] = [
  { id: "claude", label: "Claude", glyph: "✦" },
  { id: "codex", label: "Codex", glyph: " ▪" },
  { id: "copilot", label: "Copilot", glyph: "◍" },
  { id: "gemini", label: "Gemini", glyph: "✧" },
];

const MODELS: Record<Provider, string[]> = {
  claude: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  codex: ["gpt-5", "gpt-5-mini"],
  copilot: ["gpt-5", "gpt-5-mini"],
  gemini: ["gemini-2-5-pro", "gemini-2-5-flash"],
};

const MODES: Mode[] = ["plan", "code", "ask"];

export function ProviderPicker() {
  const visible = useUiStore((s) => s.providerPickerOpen);
  const setVisible = useUiStore((s) => s.setProviderPickerOpen);
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);

  const [provider, setProvider] = useState<Provider>(settings.defaultProvider);
  const [model, setModel] = useState<string>(settings.defaultModel[provider] ?? MODELS[provider][0]);
  const [mode, setMode] = useState<Mode>(settings.defaultMode);

  const apply = () => {
    patch({
      defaultProvider: provider,
      defaultModel: { ...settings.defaultModel, [provider]: model },
      defaultMode: mode,
    });
    setVisible(false);
  };

  return (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <Text style={styles.title}>Select provider</Text>

      <Text style={styles.label}>PROVIDER</Text>
      <View style={styles.providerRow}>
        {PROVIDERS.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.providerBtn, provider === p.id && styles.providerBtnActive]}
            onPress={() => {
              setProvider(p.id);
              setModel(settings.defaultModel[p.id] ?? MODELS[p.id][0]);
            }}
          >
            <Text style={styles.providerGlyph}>{p.glyph}</Text>
            <Text style={[styles.providerLabel, provider === p.id && styles.providerLabelActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>MODEL</Text>
      <View style={styles.chipRow}>
        {MODELS[provider].map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, model === m && styles.chipActive]}
            onPress={() => setModel(m)}
          >
            <Text style={[styles.chipText, model === m && styles.chipTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>MODE</Text>
      <View style={styles.segmentedRow}>
        {MODES.map((m) => (
          <Pressable
            key={m}
            style={[styles.segment, mode === m && styles.segmentActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.applyBtn} onPress={apply}>
        <Text style={styles.applyText}>Apply</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold, marginBottom: SP[3] },
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: 1, marginTop: SP[3], marginBottom: SP[2],
  },
  providerRow: { flexDirection: "row", gap: SP[3], justifyContent: "space-around" } as ViewStyle,
  providerBtn: {
    width: 64, height: 64, borderRadius: 9999,
    backgroundColor: C.surface1,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  } as ViewStyle,
  providerBtnActive: { borderColor: C.accent } as ViewStyle,
  providerGlyph: { fontSize: 24, color: C.fgMuted },
  providerLabel: { color: C.fgMuted, fontSize: FS.xs, marginTop: 2 },
  providerLabelActive: { color: C.accentBright, fontWeight: FW.semibold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SP[1] },
  chip: {
    paddingHorizontal: SP[3], paddingVertical: SP[1],
    borderRadius: 9999, backgroundColor: C.surface1,
    borderWidth: 1, borderColor: C.borderSubtle,
  } as ViewStyle,
  chipActive: { backgroundColor: C.accentDim, borderColor: C.accent } as ViewStyle,
  chipText: { color: C.fgMuted, fontSize: FS.xs },
  chipTextActive: { color: C.accentBright, fontWeight: FW.semibold },
  segmentedRow: {
    flexDirection: "row", gap: SP[1],
    backgroundColor: C.surface1, borderRadius: RD.md, padding: 2,
  } as ViewStyle,
  segment: { flex: 1, paddingVertical: SP[2], borderRadius: RD.sm, alignItems: "center" },
  segmentActive: { backgroundColor: C.accent },
  segmentText: { color: C.fgMuted, fontSize: FS.sm, textTransform: "capitalize" },
  segmentTextActive: { color: C.accentForeground, fontWeight: FW.semibold },
  applyBtn: {
    backgroundColor: C.accent,
    paddingVertical: SP[3],
    borderRadius: RD.lg,
    alignItems: "center",
    marginTop: SP[5],
  } as ViewStyle,
  applyText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },
});
