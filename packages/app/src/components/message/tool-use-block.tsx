/**
 * ToolUseBlock — collapsible tool call (3.jpg).
 *
 * Left border in paseo dark green (#307040), monospace text, dimmed color.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react-native";
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
        <View style={styles.header}>
          <Wrench size={12} color={C.accent} />
          <Text style={styles.headerText} numberOfLines={1}>tool</Text>
          {open ? <ChevronDown size={12} color={C.fgSubtle} /> : <ChevronRight size={12} color={C.fgSubtle} />}
        </View>
        <Text style={styles.text} numberOfLines={open ? undefined : 2}>{bubble.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "flex-start", marginVertical: 2 } as ViewStyle,
  bubble: {
    backgroundColor: C.surface1,
    borderRadius: RD.md,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    maxWidth: "88%",
  } as ViewStyle,
  header: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 } as ViewStyle,
  headerText: { color: C.fgSubtle, fontSize: FS.xs, fontFamily: "Menlo", flex: 1 },
  text: {
    color: C.fgMuted,
    fontSize: FS.xs,
    fontFamily: "Menlo",
  },
});
