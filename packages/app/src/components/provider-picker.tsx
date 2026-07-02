/**
 * ProviderPicker — 3.1.jpg bottom sheet.
 *
 * Sampled:
 *  - sheet bg white, 24dp top corners
 *  - 4 round provider buttons in a row (#F4F4F4 fill); selected gets
 *    paseo dark green border (#307040, 2dp)
 *  - model chips: selected text turns dark + bold, no fill change
 *  - mode segmented: selected segment BLACK fill + white text
 *  - apply button: BLACK #101010 + white text, full width, 12dp radius
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Sparkles, Terminal, Code2, Gem, X } from "lucide-react-native";
import { BottomSheet } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useSettingsStore, type Provider, type Mode } from "../stores/settings-store";

const PROVIDERS: { id: Provider; label: string; Icon: any }[] = [
  { id: "claude", label: "Claude", Icon: Sparkles },
  { id: "codex", label: "Codex", Icon: Terminal },
  { id: "copilot", label: "Copilot", Icon: Code2 },
  { id: "gemini", label: "Gemini", Icon: Gem },
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
      <View style={styles.header}>
        <Text style={styles.title}>Select provider</Text>
        <Pressable onPress={() => setVisible(false)} hitSlop={8}>
          <X size={20} color={C.fgSubtle} />
        </Pressable>
      </View>

      <Text style={styles.label}>PROVIDER</Text>
      <View style={styles.providerRow}>
        {PROVIDERS.map(({ id, label, Icon }) => (
          <Pressable
            key={id}
            style={[styles.providerBtn, provider === id && styles.providerBtnActive]}
            onPress={() => {
              setProvider(id);
              setModel(settings.defaultModel[id] ?? MODELS[id][0]);
            }}
          >
            <Icon size={22} color={provider === id ? C.accent : C.fgSubtle} />
            <Text style={[styles.providerLabel, provider === id && styles.providerLabelActive]}>
              {label}
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SP[3] },
  title: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold },
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    marginTop: SP[3], marginBottom: SP[2],
  },
  providerRow: { flexDirection: "row", gap: SP[3], justifyContent: "space-around" } as ViewStyle,
  providerBtn: {
    width: 64, height: 64, borderRadius: 9999,
    backgroundColor: C.surface1,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  } as ViewStyle,
  providerBtnActive: { borderColor: C.accent } as ViewStyle, // paseo dark green
  providerLabel: { color: C.fgSubtle, fontSize: FS.xs, marginTop: 2 },
  providerLabelActive: { color: C.accent, fontWeight: FW.semibold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SP[1] },
  chip: {
    paddingHorizontal: SP[3], paddingVertical: SP[1],
    borderRadius: 9999, backgroundColor: C.surface1,
    borderWidth: 1, borderColor: C.borderSubtle,
  } as ViewStyle,
  chipActive: { borderColor: C.fg } as ViewStyle,
  chipText: { color: C.fgSubtle, fontSize: FS.xs },
  chipTextActive: { color: C.fg, fontWeight: FW.semibold },
  segmentedRow: {
    flexDirection: "row", gap: SP[1],
    backgroundColor: C.surface1, borderRadius: RD.md, padding: 2,
  } as ViewStyle,
  segment: { flex: 1, paddingVertical: SP[2], borderRadius: RD.sm, alignItems: "center" },
  segmentActive: { backgroundColor: C.btnPrimary } as ViewStyle, // BLACK
  segmentText: { color: C.fgSubtle, fontSize: FS.sm },
  segmentTextActive: { color: C.btnPrimaryFg, fontWeight: FW.semibold },
  applyBtn: {
    backgroundColor: C.btnPrimary, // BLACK
    paddingVertical: SP[3], borderRadius: RD.lg,
    alignItems: "center", marginTop: SP[5],
  } as ViewStyle,
  applyText: { color: C.btnPrimaryFg, fontSize: FS.base, fontWeight: FW.semibold },
});
