/**
 * Composer — screenshots 2.jpg / 3.jpg bottom + 3.2.jpg attach menu.
 *
 * Layout (left → right):
 *  + button         → opens attach menu (3.2.jpg): Attach file / Take photo
 *  Text input       — multiline autosize (max 120), placeholder "Message Jarvis…"
 *                     When text starts with "/", input-store.showSlash goes true
 *                     and SlashAutocomplete mounts above the input.
 *  🎤 mic           → press-in/press-out 3-mode state machine (hold/tap/auto)
 *  ↑ send (conditional) — only renders when input has non-whitespace.
 *                     Accent purple, sends input to onSubmit.
 *
 * Phase 12 ships UI + slash + 3.2.jpg attach menu. Phase 14 wires mic to
 * voice.ts (startCapture / stopCapture) and send to client.submitCommand.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { Popover } from "../lib/ui-primitives";
import { C, FS, FW, RD, SP } from "../theme";
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
        <Pressable style={styles.iconBtn} onPress={() => setAttachMenuOpen(true)}>
          <Text style={styles.iconPlus}>+</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Jarvis…"
          placeholderTextColor={C.fgSubtle}
          multiline
          maxLength={4000}
          onSubmitEditing={submit}
          blurOnSubmit={false}
        />
        <Pressable
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          style={[styles.iconBtn, recording && styles.micActive]}
        >
          <Text style={styles.iconMic}>{recording ? "■" : "🎤"}</Text>
        </Pressable>
        {hasText ? (
          <Pressable style={[styles.iconBtn, styles.sendBtn]} onPress={submit}>
            <Text style={styles.iconSend}>↑</Text>
          </Pressable>
        ) : null}
      </View>
      <Popover
        visible={attachMenuOpen}
        onClose={() => setAttachMenuOpen(false)}
        position={{ bottom: 80, left: 12 }}
      >
        <Pressable style={styles.attachRow} onPress={() => setAttachMenuOpen(false)}>
          <Text style={styles.attachText}>📎  Attach file</Text>
        </Pressable>
        <Pressable style={styles.attachRow} onPress={() => setAttachMenuOpen(false)}>
          <Text style={styles.attachText}>📷  Take photo</Text>
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
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SP[1],
  } as ViewStyle,
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RD.full,
    backgroundColor: C.surface1,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  iconPlus: { color: C.fgMuted, fontSize: 22, fontWeight: FW.bold, marginTop: -2 },
  iconMic: { color: C.fg, fontSize: 16 },
  iconSend: { color: C.accentForeground, fontSize: 18, fontWeight: FW.bold, marginTop: -2 },
  micActive: { backgroundColor: C.destructive } as ViewStyle,
  sendBtn: { backgroundColor: C.accent } as ViewStyle,
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
  attachRow: {
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    borderRadius: RD.sm,
  },
  attachText: { color: C.fg, fontSize: FS.sm },
});
