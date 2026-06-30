import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { DARK } from "../../theme";

const SP = { 4: 16, 3: 12, 2: 8, 1: 4 };
const RD = { "2xl": 16, sm: 2 };
const FS = { xs: 12, sm: 14 };
const FW = { medium: "500" as const };

const C = DARK;

interface UserMessageProps {
  text: string;
  timestamp?: number;
}

export function UserMessage({ text, timestamp }: UserMessageProps) {
  const formatTime = (ts?: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.rowRight}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.footer}>
          <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
          {/* RewindMenu 和 TurnCopyButton 占位符 - Phase 4 实现 */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  bubble: {
    backgroundColor: C.surface3,
    borderRadius: RD["2xl"],
    borderTopRightRadius: RD.sm,
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    maxWidth: "85%",
    alignSelf: "flex-end",
  },
  text: {
    color: C.fg,
    fontSize: FS.sm,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SP[1],
    gap: SP[2],
  },
  timestamp: {
    color: C.fgMuted,
    fontSize: FS.xs,
    fontWeight: FW.medium,
  },
});
