/**
 * General — 8.2.1.jpg + 8.2.1.1.jpg system card.
 * Segmented selected = BLACK. Stepper buttons = surface1.
 */
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { C, FS, FW, RD, SP, LS } from "../../theme";
import { useSettingsStore } from "../../stores/settings-store";
import { useWorkspaceStore } from "../../stores/workspace-store";

export function General() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const workspaceList = useWorkspaceStore((s) => s.workspaceList);

  return (
    <ScrollView contentContainerStyle={{ padding: SP[4], paddingBottom: SP[6] }}>
      <Text style={styles.label}>DEFAULT SEND MODE</Text>
      <Segmented
        value={settings.defaultSpawnMode}
        options={[{ v: "spawn", label: "Spawn" }, { v: "tmux", label: "tmux" }]}
        onChange={(v) => patch({ defaultSpawnMode: v as "spawn" | "tmux" })}
      />

      <Text style={styles.label}>DEFAULT ENGINE</Text>
      <Segmented
        value={settings.defaultEngine}
        options={[
          { v: "claude", label: "Claude" },
          { v: "codex", label: "Codex" },
          { v: "copilot", label: "Copilot" },
          { v: "gemini", label: "Gemini" },
        ]}
        onChange={(v) => patch({ defaultEngine: v as any })}
      />

      <Text style={styles.label}>TERMINAL SCROLLBACK (lines)</Text>
      <Stepper
        value={settings.scrollbackLines}
        step={1000}
        min={1000}
        max={50000}
        onChange={(n) => patch({ scrollbackLines: n })}
      />

      <Text style={styles.label}>AUTO WAKEWORD</Text>
      <ToggleRow
        value={settings.autoWake}
        onChange={(v) => patch({ autoWake: v })}
        hint="Start listening for wake word on app boot."
      />

      <Text style={styles.label}>CONVERSATION MODE</Text>
      <ToggleRow
        value={settings.convMode}
        onChange={(v) => patch({ convMode: v })}
        hint="After TTS, auto-listen for next turn."
      />

      <Text style={[styles.label, { marginTop: SP[5] }]}>SYSTEM</Text>
      <View style={styles.card}>
        <SysRow k="CPU" v="Apple M1 (8-core)" />
        <SysRow k="Memory" v="16 GB" />
        <SysRow k="Disk free" v="85 GB / 100 GB sparsebundle" />
        <SysRow k="OS" v="macOS 26 (Sequoia)" />
        <SysRow k="App version" v="0.1.0 v2-from-scratch" />
        <SysRow k="Projects" v={`${workspaceList.length}`} last />
      </View>
    </ScrollView>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmentedRow}>
      {options.map((o) => (
        <Pressable
          key={o.v}
          style={[styles.segment, value === o.v && styles.segmentActive]}
          onPress={() => onChange(o.v)}
        >
          <Text style={[styles.segmentText, value === o.v && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stepper({ value, step, min, max, onChange }: { value: number; step: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
        <Minus size={14} color={C.fg} />
      </Pressable>
      <Text style={styles.stepValue}>{value.toLocaleString()}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
        <Plus size={14} color={C.fg} />
      </Pressable>
    </View>
  );
}

function ToggleRow({ value, onChange, hint }: { value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </View>
      {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function SysRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={[styles.sysRow, !last && styles.sysRowBorder]}>
      <Text style={styles.sysKey}>{k}</Text>
      <Text style={styles.sysVal} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: C.fgSubtle, fontSize: FS.xs, fontWeight: FW.semibold,
    letterSpacing: LS.wide, marginTop: SP[3], marginBottom: SP[1],
  },
  segmentedRow: { flexDirection: "row", gap: SP[1], backgroundColor: C.surface1, borderRadius: RD.md, padding: 2 },
  segment: { flex: 1, paddingVertical: SP[2], borderRadius: RD.sm, alignItems: "center" },
  segmentActive: { backgroundColor: C.btnPrimary } as ViewStyle,
  segmentText: { color: C.fgSubtle, fontSize: FS.sm },
  segmentTextActive: { color: C.btnPrimaryFg, fontWeight: FW.semibold },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: SP[3], backgroundColor: C.surface1, borderRadius: RD.md, padding: SP[2] },
  stepBtn: { width: 32, height: 32, borderRadius: RD.sm, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  stepValue: { color: C.fg, fontSize: FS.base, fontVariant: ["tabular-nums"] },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: SP[3] } as ViewStyle,
  toggleTrack: { width: 44, height: 24, borderRadius: 9999, backgroundColor: C.surface3, padding: 2 } as ViewStyle,
  toggleTrackActive: { backgroundColor: C.btnPrimary } as ViewStyle,
  toggleThumb: { width: 20, height: 20, borderRadius: 9999, backgroundColor: C.bg } as ViewStyle,
  toggleThumbActive: { backgroundColor: C.btnPrimaryFg, transform: [{ translateX: 20 }] } as ViewStyle,
  toggleHint: { color: C.fgSubtle, fontSize: FS.xs, flex: 1 },
  card: {
    backgroundColor: C.bg, borderRadius: RD.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle,
  },
  sysRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SP[2], paddingHorizontal: SP[3] } as ViewStyle,
  sysRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle },
  sysKey: { color: C.fgSubtle, fontSize: FS.sm },
  sysVal: { color: C.fg, fontSize: FS.sm, fontWeight: FW.medium },
});
