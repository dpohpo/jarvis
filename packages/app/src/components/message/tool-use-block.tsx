/**
 * ToolUseBlock — left-aligned, surface1 fill, purple left bar.
 *
 * 3.jpg tool rows: monospace, smaller font, dimmed color, collapsible.
 * The purple left border matches the accent color used elsewhere so
 * tool calls read as "part of the assistant turn" but visually scannable
 * as distinct from the prose.
 *
 * Tap toggles collapse/expand so long tool outputs don't drown the chat.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function ToolUseBlock({ bubble }: { bubble: Bubble }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.bubble}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
      >
        <View style={styles.bar} />
        <Text style={styles.text} numberOfLines={open ? undefined : 2}>{bubble.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginVertical: 2,
  } as ViewStyle,
  bubble: {
    flexDirection: "row",
    backgroundColor: C.surface1,
    borderRadius: RD.md,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    maxWidth: "88%",
    gap: SP[1],
  } as ViewStyle,
  bar: { width: 0 } as ViewStyle, // spacer for visual rhythm
  text: {
    color: C.fgMuted,
    fontSize: FS.xs,
    fontFamily: "Menlo",
    flex: 1,
  },
});
