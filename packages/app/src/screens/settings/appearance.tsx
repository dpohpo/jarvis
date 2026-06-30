/**
 * Appearance Section — 外观设置
 *
 * - 主题选择器：6 种主题（dark/zinc/midnight/claude/ghostty/light）
 * - 字体大小
 * - 代码高亮 toggle
 */
import { View, Text, Pressable, ScrollView } from "react-native";
import { C, SP, RD, THEMES, type ThemeName } from "../../theme";

interface AppearanceSectionProps {
  settings: Record<string, unknown>;
  onSetSetting: (key: string, value: unknown) => void;
}

const THEME_OPTIONS: { value: ThemeName; label: string; color: string }[] = [
  { value: "dark", label: "Dark", color: THEMES.dark.accent },
  { value: "zinc", label: "Zinc", color: THEMES.zinc.accent },
  { value: "midnight", label: "Midnight", color: THEMES.midnight.accent },
  { value: "claude", label: "Claude", color: THEMES.claude.accent },
  { value: "ghostty", label: "Ghostty", color: THEMES.ghostty.accent },
  { value: "light", label: "Light", color: THEMES.light.accent },
];

export function AppearanceSection({ settings, onSetSetting }: AppearanceSectionProps) {
  const theme = (settings.theme as ThemeName) ?? "dark";
  const fontSize = (settings.fontSize as number) ?? 16;
  const codeHighlight = (settings.codeHighlight as boolean) ?? true;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Theme Picker */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>主题</Text>
            <Text style={styles.rowHint}>选择界面配色方案</Text>
          </View>
        </View>
        <View style={styles.themeGrid}>
          {THEME_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.themeOption, theme === opt.value && styles.themeOptionSelected]}
              onPress={() => onSetSetting("theme", opt.value)}
            >
              <View style={[styles.themeSwatch, { backgroundColor: opt.color }]} />
              <Text
                style={[
                  styles.themeLabel,
                  theme === opt.value && styles.themeLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Font Size */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>字体大小</Text>
            <Text style={styles.rowHint}>界面文字大小</Text>
          </View>
          <Text style={styles.value}>{fontSize}px</Text>
        </View>

        {/* Code Highlight */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>代码高亮</Text>
            <Text style={styles.rowHint}>代码块语法高亮</Text>
          </View>
          <Pressable
            style={[styles.toggle, codeHighlight && styles.toggleOn]}
            onPress={() => onSetSetting("codeHighlight", !codeHighlight)}
          >
            <View style={[styles.toggleKnob, codeHighlight && styles.toggleKnobOn]} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[4],
    paddingHorizontal: SP[4],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: C.fg,
    marginBottom: 2,
  },
  rowHint: {
    fontSize: 12,
    color: C.fgMuted,
  },
  value: {
    fontSize: 14,
    color: C.fgMuted,
  },
  themeGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    paddingHorizontal: SP[4],
    paddingBottom: SP[4],
    gap: SP[3],
  },
  themeOption: {
    width: 80,
    alignItems: "center" as const,
    padding: SP[3],
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  themeOptionSelected: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  themeSwatch: {
    width: 32,
    height: 32,
    borderRadius: RD.md,
    marginBottom: SP[2],
  },
  themeLabel: {
    fontSize: 12,
    color: C.fgMuted,
  },
  themeLabelSelected: {
    color: C.fg,
    fontWeight: "600" as const,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface3,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: C.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.fg,
  },
  toggleKnobOn: {
    backgroundColor: C.accentForeground,
    alignSelf: "flex-end" as const,
  },
};
