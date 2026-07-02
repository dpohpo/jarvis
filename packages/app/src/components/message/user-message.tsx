/**
 * UserMessage — 3.jpg user bubble.
 *
 * Sampled: BLACK fill (#101010), white text, max-width ~80%, 18dp radius
 * with the top-right corner pulled in (suggests speech direction).
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
    backgroundColor: C.btnPrimary, // BLACK #101010
    borderRadius: RD.xl,
    borderTopRightRadius: RD.sm,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "82%",
  } as ViewStyle,
  text: {
    color: C.btnPrimaryFg,
    fontSize: FS.sm,
    lineHeight: Math.round(FS.sm * LH.base),
  },
});
