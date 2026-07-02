/**
 * AssistantMessage — 3.jpg assistant bubble.
 *
 * Sampled: #F4F4F4 fill (surface1), dark text, max-width ~88%, 18dp radius
 * with the top-left corner pulled in.
 *
 * Plain text rendering (markdown lib incompatible with RN 0.85 — see
 * visual-spec.md). Code fences / lists come through unstyled.
 */
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, LH, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function AssistantMessage({ bubble }: { bubble: Bubble }) {
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
    justifyContent: "flex-start",
    marginVertical: SP[1],
  } as ViewStyle,
  bubble: {
    backgroundColor: C.surface1, // #F4F4F4
    borderRadius: RD.xl,
    borderTopLeftRadius: RD.sm,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "90%",
  } as ViewStyle,
  text: {
    color: C.fg,
    fontSize: FS.sm,
    lineHeight: Math.round(FS.sm * LH.relaxed),
  },
});
