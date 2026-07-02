/**
 * Providers section — per-provider API key / token / path configuration.
 *
 * Values are stored in SecureStore via the settings-store (Phase 6
 * already persists). Fields render as masked text inputs (password
 * entry) so shoulder-surfers can't read keys.
 */
import { ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP, LS } from "../../theme";
import { useSettingsStore } from "../../stores/settings-store";

export function Providers() {
  return (
    <ScrollView contentContainerStyle={{ padding: SP[3] }}>
      <ProviderField label="Claude" hint="Anthropic API key (sk-ant-...)" placeholder="sk-ant-..." />
      <ProviderField label="Codex" hint="Path to codex CLI" placeholder="/usr/local/bin/codex" />
      <ProviderField label="Copilot" hint="GitHub Copilot token (ghu_...)" placeholder="ghu_..." />
      <ProviderField label="Gemini" hint="Google AI Studio API key (AIza...)" placeholder="AIza..." />
    </ScrollView>
  );
}

function ProviderField({ label, hint, placeholder }: { label: string; hint: string; placeholder: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={C.fgSubtle}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: SP[4] },
  label: {
    color: C.accentHover, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide,
  },
  hint: { color: C.fgSubtle, fontSize: FS.xs, marginTop: 2, marginBottom: SP[1] },
  input: {
    backgroundColor: C.surface1,
    color: C.fg,
    borderRadius: RD.md,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    fontSize: FS.sm,
    fontFamily: "Menlo",
  },
});
