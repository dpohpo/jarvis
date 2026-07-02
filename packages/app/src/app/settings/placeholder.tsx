/**
 * Section placeholder — used by 9 of the 14 sections that don't have
 * screenshot-specified content yet (Permissions / Diagnostics / About /
 * Agents / Workspaces / Usage / Terminals / Host).
 *
 * Phase 14-15 will replace these with concrete implementations as the
 * daemon-side data becomes available (perm rules, log streams, agent
 * directory, workspace configs, usage metrics, tmux config, host info).
 */
import { StyleSheet, Text, View } from "react-native";
import { C, FS, FW, SP } from "../../theme";
import type { SettingsSection } from "../../stores/ui-store";

const HINTS: Partial<Record<SettingsSection, string>> = {
  permissions: "Tier 1/2/3 approval rules mount here in Phase 14 once client.onPermRequest is wired.",
  diagnostics: "Live log stream + reconnect test will land here in Phase 14.",
  about: "App version 0.1.0 · Branch v2-from-scratch · github.com/dpohpo/jarvis",
  agents: "Agent spawn defaults / tmux pane templates land here in Phase 14.",
  workspaces: "Project list mirrors LeftSidebar. Phase 14 will add rename / archive / delete.",
  usage: "Token usage and cost dashboard will land once the daemon emits usage events.",
  terminals: "tmux config (default session, pane layout) will land in Phase 15.",
  host: "Current Mac: Poincare-Mac-mini · daemon PID 3821 · 8788 listen.",
};

export function SectionPlaceholder({ section }: { section: SettingsSection }) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{HINTS[section] ?? "Section content lands in a later phase."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24 },
  text: { color: C.fgSubtle, fontSize: FS.sm, fontWeight: FW.regular, lineHeight: 22 },
});
