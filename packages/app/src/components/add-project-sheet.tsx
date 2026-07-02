/**
 * AddProjectSheet — screenshot 2.1.jpg.
 *
 * Bottom sheet that opens when user taps the + button on EmptyMain.
 * Collects:
 *  - project name (text input)
 *  - spawn mode (spawn | tmux, radio)
 *  - engine (claude | codex | copilot | gemini, chips)
 *  - tmux pane target (optional, shown only when spawn mode = tmux)
 *
 * Create button calls (Phase 14 wires):
 *  client.setWorkspaceConfig({ ... }) + client.createAgent / submitCommand
 *
 * Phase 10 ships UI + local state + the create handler shell. The shell
 * writes defaults to settings-store + creates a placeholder project row
 * in workspace-store so the user sees immediate feedback even before
 * the daemon confirms.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { BottomSheet } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useSettingsStore, type Provider } from "../stores/settings-store";

const ENGINES: Provider[] = ["claude", "codex", "copilot", "gemini"];

export function AddProjectSheet() {
  const visible = useUiStore((s) => s.addProjectOpen);
  const setVisible = useUiStore((s) => s.setAddProjectOpen);
  const addWorkspace = useWorkspaceStore((s) => s.setWorkspaceList);
  const existing = useWorkspaceStore((s) => s.workspaceList);
  const setWorkspaceActive = useWorkspaceStore((s) => s.setWorkspaceActive);
  const settings = useSettingsStore((s) => s.settings);

  const [name, setName] = useState("");
  const [spawnMode, setSpawnMode] = useState<"spawn" | "tmux">(settings.defaultSpawnMode);
  const [engine, setEngine] = useState<Provider>(settings.defaultEngine);
  const [tmuxPane, setTmuxPane] = useState("");

  const close = () => {
    setName("");
    setTmuxPane("");
    setVisible(false);
  };

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!existing.includes(trimmed)) {
      addWorkspace([...existing, trimmed]);
    }
    setWorkspaceActive(trimmed);
    // Phase 14 will additionally call:
    //   client.setWorkspaceConfig({ mode: spawnMode, engine, tmuxPane })
    //   client.submitCommand(...) to spawn the agent
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <Text style={styles.title}>Add a project</Text>

      <Text style={styles.label}>Project name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. jarvis-android"
        placeholderTextColor={C.fgSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      <Text style={styles.label}>Spawn mode</Text>
      <View style={styles.segmentedRow}>
        {(["spawn", "tmux"] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.segment, spawnMode === m && styles.segmentActive]}
            onPress={() => setSpawnMode(m)}
          >
            <Text style={[styles.segmentText, spawnMode === m && styles.segmentTextActive]}>
              {m === "spawn" ? "Spawn" : "tmux"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Engine</Text>
      <View style={styles.chipRow}>
        {ENGINES.map((e) => (
          <Pressable
            key={e}
            style={[styles.chip, engine === e && styles.chipActive]}
            onPress={() => setEngine(e)}
          >
            <Text style={[styles.chipText, engine === e && styles.chipTextActive]}>
              {e}
            </Text>
          </Pressable>
        ))}
      </View>

      {spawnMode === "tmux" ? (
        <>
          <Text style={styles.label}>tmux pane target (optional)</Text>
          <TextInput
            style={styles.input}
            value={tmuxPane}
            onChangeText={setTmuxPane}
            placeholder="e.g. main:0.1"
            placeholderTextColor={C.fgSubtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable style={[styles.btn, styles.btnSecondary, styles.flex1]} onPress={close}>
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary, styles.flex1, !name.trim() && styles.btnDisabled]}
          onPress={create}
          disabled={!name.trim()}
        >
          <Text style={styles.btnPrimaryText}>Create</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: C.fg, fontSize: FS.lg, fontWeight: FW.semibold, marginBottom: SP[3] },
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: 1, marginTop: SP[3], marginBottom: SP[1],
  },
  input: {
    backgroundColor: C.surface1,
    color: C.fg,
    borderRadius: RD.md,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    fontSize: FS.sm,
  },
  segmentedRow: { flexDirection: "row", gap: SP[1], backgroundColor: C.surface1, borderRadius: RD.md, padding: 2 },
  segment: { flex: 1, paddingVertical: SP[2], borderRadius: RD.sm, alignItems: "center" },
  segmentActive: { backgroundColor: C.accent },
  segmentText: { color: C.fgMuted, fontSize: FS.sm },
  segmentTextActive: { color: C.accentForeground, fontWeight: FW.semibold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SP[1] },
  chip: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RD.full,
    backgroundColor: C.surface1,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  } as ViewStyle,
  chipActive: { backgroundColor: C.accentDim, borderColor: C.accent } as ViewStyle,
  chipText: { color: C.fgMuted, fontSize: FS.sm },
  chipTextActive: { color: C.accentBright, fontWeight: FW.semibold },
  actionRow: { flexDirection: "row", gap: SP[2], marginTop: SP[5] },
  btn: { paddingVertical: SP[3], borderRadius: RD.lg, alignItems: "center", justifyContent: "center" } as ViewStyle,
  btnPrimary: { backgroundColor: C.accent } as ViewStyle,
  btnPrimaryText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },
  btnSecondary: { backgroundColor: C.surface1 } as ViewStyle,
  btnSecondaryText: { color: C.fgMuted, fontSize: FS.base },
  btnDisabled: { opacity: 0.4 } as ViewStyle,
  flex1: { flex: 1 } as ViewStyle,
});
