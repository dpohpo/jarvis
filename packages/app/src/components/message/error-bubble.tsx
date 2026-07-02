/**
 * ErrorBubble — red-left-bar error message.
 */
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function ErrorBubble({ bubble }: { bubble: Bubble }) {
  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "flex-start", marginVertical: 2 } as ViewStyle,
  bubble: {
    backgroundColor: C.surface1,
    borderRadius: RD.md,
    borderLeftWidth: 2,
    borderLeftColor: C.destructive,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    maxWidth: "88%",
  } as ViewStyle,
  text: { color: C.destructive, fontSize: FS.xs, fontFamily: "Menlo" },
});
