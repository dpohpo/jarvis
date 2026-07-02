/**
 * SystemBubble — centered chip for system messages.
 *
 * Used for non-chat events the user should notice but not interact with:
 * "Agent created", "Switched workspace", "Disconnected", etc.
 */
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function SystemBubble({ bubble }: { bubble: Bubble }) {
  return (
    <View style={styles.row}>
      <View style={styles.chip}>
        <Text style={styles.text}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SP[1],
  } as ViewStyle,
  chip: {
    backgroundColor: C.surface1,
    borderRadius: RD.full,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  } as ViewStyle,
  text: {
    color: C.fgSubtle,
    fontSize: FS.xs,
  },
});
