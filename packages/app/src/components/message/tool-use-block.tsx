import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { DARK } from "../../theme";

const SP = { 3: 12, 2: 8, 1: 4 };
const RD = { lg: 8, base: 4 };
const FS = { xs: 12, sm: 14 };
const FW = { semibold: "600" as const };

const C = DARK;

interface ToolUseBlockProps {
  command: string;
  input?: string;
}

export function ToolUseBlock({ command, input }: ToolUseBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={[styles.indicator, expanded && styles.indicatorExpanded]} />
        <Text style={styles.icon}>⚙</Text>
        <Text style={styles.command} numberOfLines={1}>
          {command}
        </Text>
      </Pressable>
      {expanded && (
        <View style={styles.details}>
          {input && (
            <Text style={styles.inputText}>{input}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    marginBottom: SP[2],
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: SP[2],
    gap: SP[2],
  },
  indicator: {
    width: 3,
    height: 16,
    backgroundColor: C.accent,
    borderRadius: RD.base,
  },
  indicatorExpanded: {
    backgroundColor: C.accentBright,
  },
  icon: {
    fontSize: FS.sm,
  },
  command: {
    flex: 1,
    color: C.fgMuted,
    fontSize: FS.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  details: {
    padding: SP[2],
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  inputText: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
});
