/**
 * SettingsScreen — screenshot 8.2.jpg.
 *
 * Top-level settings list. Two grouped sections (App / Host) covering
 * the 12 entries from the screenshot (Phase 13 also adds "system" as
 * a sub-page of General, hence 13 visible rows counting system).
 *
 * Tapping a row sets ui-store.settingsSection and pushes the matching
 * section file on top via the inline render switch below.
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP, LS } from "../theme";
import { useUiStore, type SettingsSection } from "../stores/ui-store";
import { General } from "./settings/general";
import { Appearance } from "./settings/appearance";
import { Providers } from "./settings/providers";
import { Connections } from "./settings/connections";
import { SectionPlaceholder } from "./settings/placeholder";

interface SectionMeta {
  id: SettingsSection;
  label: string;
  glyph: string;
  description: string;
}

const APP_GROUP: SectionMeta[] = [
  { id: "general", label: "General", glyph: "⚙", description: "Defaults, language, terminal" },
  { id: "appearance", label: "Appearance", glyph: "🎨", description: "Theme, font size" },
  { id: "permissions", label: "Permissions", glyph: "🔐", description: "Tier 1/2/3 approvals" },
  { id: "diagnostics", label: "Diagnostics", glyph: "🩺", description: "Logs, reconnect test" },
  { id: "about", label: "About", glyph: "ℹ", description: "Version, repo" },
];

const HOST_GROUP: SectionMeta[] = [
  { id: "connections", label: "Connections", glyph: "🔗", description: "Hosts, relays" },
  { id: "agents", label: "Agents", glyph: "🤖", description: "Spawn defaults, tmux" },
  { id: "workspaces", label: "Workspaces", glyph: "📁", description: "Project list, switch" },
  { id: "providers", label: "Providers", glyph: "✦", description: "Per-provider keys" },
  { id: "usage", label: "Usage", glyph: "📊", description: "Token usage, cost" },
  { id: "terminals", label: "Terminals", glyph: "⌨", description: "tmux config" },
  { id: "host", label: "Host", glyph: "🖥", description: "This Mac, restart daemon" },
];

export function SettingsScreen() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);

  if (!open) return null;

  if (section !== null) {
    // Render the chosen section as an inline screen with a back chevron.
    return (
      <View style={styles.root}>
        <View style={styles.sectionHeader}>
          <Pressable style={styles.backBtn} onPress={() => setSection(null)}>
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>{labelFor(section)}</Text>
        </View>
        {renderSection(section)}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => setOpen(false)}>
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: SP[6] }}>
        <Text style={styles.groupHeader}>APP</Text>
        {APP_GROUP.map((s) => (
          <Row key={s.id} meta={s} onPress={() => setSection(s.id)} />
        ))}
        <Text style={[styles.groupHeader, { marginTop: SP[4] }]}>HOST</Text>
        {HOST_GROUP.map((s) => (
          <Row key={s.id} meta={s} onPress={() => setSection(s.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function renderSection(s: SettingsSection) {
  switch (s) {
    case "general": return <General />;
    case "appearance": return <Appearance />;
    case "providers": return <Providers />;
    case "connections": return <Connections />;
    case "permissions":
    case "diagnostics":
    case "about":
    case "agents":
    case "workspaces":
    case "usage":
    case "terminals":
    case "host":
      return <SectionPlaceholder section={s} />;
  }
}

function labelFor(s: SettingsSection): string {
  return [...APP_GROUP, ...HOST_GROUP].find((x) => x.id === s)?.label ?? s;
}

function Row({ meta, onPress }: { meta: SectionMeta; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowGlyph}>{meta.glyph}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{meta.label}</Text>
        <Text style={styles.rowDesc} numberOfLines={1}>{meta.description}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.bg,
  } as ViewStyle,
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: SP[3],
    paddingBottom: SP[2],
    gap: SP[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: SP[3],
    paddingBottom: SP[2],
    gap: SP[2],
  } as ViewStyle,
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  backGlyph: { color: C.accent, fontSize: 22 },
  headerTitle: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold },
  sectionTitle: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold },
  groupHeader: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, paddingHorizontal: SP[3], paddingVertical: SP[2],
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[2],
    paddingHorizontal: SP[3], paddingVertical: SP[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  rowGlyph: { fontSize: 18 },
  rowBody: { flex: 1 } as ViewStyle,
  rowLabel: { color: C.fg, fontSize: FS.base },
  rowDesc: { color: C.fgSubtle, fontSize: FS.xs, marginTop: 2 },
  rowChevron: { color: C.fgSubtle, fontSize: 18 },
});
