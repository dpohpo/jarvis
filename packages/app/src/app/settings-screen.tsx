/**
 * SettingsScreen — 8.2.jpg main list.
 *
 * White bg, iOS-style grouped list. Sections: APP and HOST.
 * Each row has a glyph, label, optional description, chevron right.
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  Settings as SettingsIcon, Palette, Lock, Stethoscope, Info,
  Plug, Bot, Folder, Sparkles, BarChart3, TerminalSquare, Server,
  ChevronLeft, ChevronRight,
} from "lucide-react-native";
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
  Icon: any;
  description: string;
}

const APP_GROUP: SectionMeta[] = [
  { id: "general", label: "General", Icon: SettingsIcon, description: "Defaults, language, terminal" },
  { id: "appearance", label: "Appearance", Icon: Palette, description: "Theme, font size" },
  { id: "permissions", label: "Permissions", Icon: Lock, description: "Tier 1/2/3 approvals" },
  { id: "diagnostics", label: "Diagnostics", Icon: Stethoscope, description: "Logs, reconnect test" },
  { id: "about", label: "About", Icon: Info, description: "Version, repo" },
];

const HOST_GROUP: SectionMeta[] = [
  { id: "connections", label: "Connections", Icon: Plug, description: "Hosts, relays" },
  { id: "agents", label: "Agents", Icon: Bot, description: "Spawn defaults, tmux" },
  { id: "workspaces", label: "Workspaces", Icon: Folder, description: "Project list, switch" },
  { id: "providers", label: "Providers", Icon: Sparkles, description: "Per-provider keys" },
  { id: "usage", label: "Usage", Icon: BarChart3, description: "Token usage, cost" },
  { id: "terminals", label: "Terminals", Icon: TerminalSquare, description: "tmux config" },
  { id: "host", label: "Host", Icon: Server, description: "This Mac, restart daemon" },
];

export function SettingsScreen() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);

  if (!open) return null;

  if (section !== null) {
    return (
      <View style={styles.root}>
        <View style={styles.sectionHeader}>
          <Pressable style={styles.backBtn} onPress={() => setSection(null)} hitSlop={8}>
            <ChevronLeft size={22} color={C.accent} />
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
        <Pressable style={styles.backBtn} onPress={() => setOpen(false)} hitSlop={8}>
          <ChevronLeft size={22} color={C.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: SP[6] }}>
        <Text style={styles.groupHeader}>APP</Text>
        <View style={styles.groupCard}>
          {APP_GROUP.map((s, i) => (
            <Row key={s.id} meta={s} onPress={() => setSection(s.id)} isLast={i === APP_GROUP.length - 1} />
          ))}
        </View>
        <Text style={[styles.groupHeader, { marginTop: SP[4] }]}>HOST</Text>
        <View style={styles.groupCard}>
          {HOST_GROUP.map((s, i) => (
            <Row key={s.id} meta={s} onPress={() => setSection(s.id)} isLast={i === HOST_GROUP.length - 1} />
          ))}
        </View>
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
    default: return <SectionPlaceholder section={s} />;
  }
}

function labelFor(s: SettingsSection): string {
  return [...APP_GROUP, ...HOST_GROUP].find((x) => x.id === s)?.label ?? s;
}

function Row({ meta, onPress, isLast }: { meta: SectionMeta; onPress: () => void; isLast: boolean }) {
  const { Icon } = meta;
  return (
    <Pressable
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
    >
      <View style={styles.rowIconWrap}>
        <Icon size={16} color={C.fg} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{meta.label}</Text>
        <Text style={styles.rowDesc} numberOfLines={1}>{meta.description}</Text>
      </View>
      <ChevronRight size={16} color={C.fgSubtle} />
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
    flexDirection: "row", alignItems: "center",
    paddingTop: 54, paddingHorizontal: SP[3], paddingBottom: SP[2], gap: SP[2],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 54, paddingHorizontal: SP[3], paddingBottom: SP[2], gap: SP[2],
  } as ViewStyle,
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold },
  sectionTitle: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold },
  groupHeader: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, paddingHorizontal: SP[4], paddingVertical: SP[2],
  },
  groupCard: {
    backgroundColor: C.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  row: {
    flexDirection: "row", alignItems: "center", gap: SP[3],
    paddingHorizontal: SP[4], paddingVertical: SP[3],
    backgroundColor: C.bg,
  } as ViewStyle,
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle },
  rowIconWrap: { width: 22, alignItems: "center" } as ViewStyle,
  rowBody: { flex: 1 } as ViewStyle,
  rowLabel: { color: C.fg, fontSize: FS.base },
  rowDesc: { color: C.fgSubtle, fontSize: FS.xs, marginTop: 2 },
});
