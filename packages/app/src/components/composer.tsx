/**
 * Composer — 2.jpg / 3.jpg bottom + 3.2.jpg attach menu.
 *
 * Sampled layout (left → right):
 *   + (Plus)        → opens attach Popover (3.2.jpg)
 *   TextInput       — surface1 fill, 24dp radius, multi-line autosize
 *   Mic             — circular surface1 button, lucide Mic icon
 *   ↑ (ArrowUp)     — BLACK button, only when input has text
 *
 * Slash autocomplete mounts above the row when text starts with "/".
 */
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { Plus, Mic, Square, ArrowUp } from "lucide-react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, RD, SP } from "../theme";
import { useInputStore } from "../stores/input-store";
import { useUiStore } from "../stores/ui-store";
import { SlashAutocomplete } from "./slash-autocomplete";

interface Props {
  onSubmit: (text: string) => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
}

const COMMON_SLASHES = ["/clear", "/agents", "/help", "/spawn", "/mode", "/stop"];

export function Composer({ onSubmit, onMicPressIn, onMicPressOut }: Props) {
  const input = useInputStore((s) => s.input);
  const setInput = useInputStore((s) => s.setInput);
  const recording = useInputStore((s) => s.recording);
  const showSlash = useInputStore((s) => s.showSlash);
  const attachMenuOpen = useUiStore((s) => s.attachMenuOpen);
  const setAttachMenuOpen = useUiStore((s) => s.setAttachMenuOpen);

  const hasText = input.trim().length > 0;

  const submit = () => {
    if (!hasText) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <View style={styles.root}>
      <SlashAutocomplete visible={showSlash} options={COMMON_SLASHES} />
      <View style={styles.row}>
        <Pressable style={styles.iconBtn} onPress={() => setAttachMenuOpen(true)} hitSlop={8}>
          <Plus size={22} color={C.fgSubtle} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Jarvis…"
          placeholderTextColor={C.fgFaint}
          multiline
          maxLength={4000}
          blurOnSubmit={false}
        />
        <Pressable
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          style={[styles.iconBtn, recording && styles.micActive]}
          hitSlop={8}
        >
          {recording ? <Square size={16} color={C.btnPrimaryFg} fill={C.btnPrimaryFg} /> : <Mic size={18} color={C.fg} />}
        </Pressable>
        {hasText ? (
          <Pressable style={[styles.iconBtn, styles.sendBtn]} onPress={submit} hitSlop={8}>
            <ArrowUp size={18} color={C.btnPrimaryFg} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
      <Popover
        visible={attachMenuOpen}
        onClose={() => setAttachMenuOpen(false)}
        position={{ bottom: 80, left: 12 }}
      >
        <Pressable style={styles.attachRow} onPress={() => setAttachMenuOpen(false)}>
          <Text style={styles.attachText}>Attach file</Text>
        </Pressable>
        <Pressable style={styles.attachRow} onPress={() => setAttachMenuOpen(false)}>
          <Text style={styles.attachText}>Take photo</Text>
        </Pressable>
      </Popover>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: C.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.borderSubtle,
    paddingHorizontal: SP[2],
    paddingVertical: SP[2],
  } as ViewStyle,
  row: { flexDirection: "row", alignItems: "flex-end", gap: SP[1] } as ViewStyle,
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RD.full,
    backgroundColor: C.surface1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  micActive: { backgroundColor: C.statusError } as ViewStyle,
  sendBtn: { backgroundColor: C.btnPrimary } as ViewStyle, // BLACK
  input: {
    flex: 1,
    backgroundColor: C.surface1,
    color: C.fg,
    borderRadius: RD["2xl"],
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    fontSize: FS.sm,
    maxHeight: 120,
  },
  attachRow: { paddingVertical: SP[2], paddingHorizontal: SP[3], borderRadius: RD.sm },
  attachText: { color: C.fg, fontSize: FS.sm },
});
