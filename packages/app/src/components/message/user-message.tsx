/**
 * UserMessage — right-aligned accent bubble.
 *
 * 3.jpg user row: purple fill (C.accent), accentForeground text,
 * border-radius 24 (RD.2xl) overall, with the top-right corner pulled
 * in to 6 (RD.sm) to suggest a speech-tail direction.
 */
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, LH, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function UserMessage({ bubble }: { bubble: Bubble }) {
  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginVertical: SP[1],
  } as ViewStyle,
  bubble: {
    backgroundColor: C.accent,
    borderRadius: RD["2xl"],
    borderTopRightRadius: RD.sm,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "85%",
  } as ViewStyle,
  text: {
    color: C.accentForeground,
    fontSize: FS.sm,
    lineHeight: Math.round(FS.sm * LH.base),
  },
});
