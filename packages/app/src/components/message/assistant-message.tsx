/**
 * AssistantMessage — left-aligned surface bubble.
 *
 * 3.jpg assistant row: grey fill (C.surface2), multi-line text.
 *
 * Originally used react-native-markdown-display (Phase 11), but
 * markdown-it@10 pulls in punycode which RN's metro doesn't ship.
 * Phase 15 dropped the dep and renders plain text — code blocks /
 * lists in the text come through unstyled but readable. A future
 * phase can swap in `marked` + custom render or a maintained RN
 * markdown lib once one is compatible with RN 0.85 / Expo 56.
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
    backgroundColor: C.surface2,
    borderRadius: RD["2xl"],
    borderTopLeftRadius: RD.sm,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "92%",
  } as ViewStyle,
  text: {
    color: C.fg,
    fontSize: FS.sm,
    lineHeight: Math.round(FS.sm * LH.relaxed),
  },
});

