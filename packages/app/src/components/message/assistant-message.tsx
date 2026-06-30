import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DARK } from "../../theme";
import { renderMarkdownLite } from "../../lib/markdown";

const SP = { 3: 12, 2: 8 };
const RD = { xl: 12, base: 4 };
const FS = { sm: 14, xs: 12 };

const C = DARK;

interface AssistantMessageProps {
  text: string;
}

export function AssistantMessage({ text }: AssistantMessageProps) {
  return (
    <View style={styles.rowLeft}>
      <View style={styles.bubble}>
        <View style={styles.content}>
          {renderMarkdownLite(text)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowLeft: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  bubble: {
    backgroundColor: C.surface2,
    borderRadius: RD.xl,
    borderBottomLeftRadius: RD.base,
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  content: {
    gap: SP[2],
  },
});
