/**
 * AssistantMessage — left-aligned surface bubble with markdown rendering.
 *
 * 3.jpg assistant row: grey fill (C.surface2), primary text, multi-block
 * markdown content (lists, code, paragraphs, links). Uses
 * react-native-markdown-display (Phase 11 dependency).
 *
 * The markdown styles are tuned dark-theme: fg / fgMuted / accent for
 * links / mono code with surface3 background.
 */
import { StyleSheet, View, ViewStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import { C, FS, FW, LH, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";

export function AssistantMessage({ bubble }: { bubble: Bubble }) {
  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Markdown style={mdStyles}>{bubble.text}</Markdown>
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
});

// Markdown style overrides — react-native-markdown-display uses a rules
// object; passing a style object via the `style` prop is supported for
// the default rule set.
const mdStyles = {
  body: {
    color: C.fg,
    fontSize: FS.sm,
    lineHeight: Math.round(FS.sm * LH.relaxed),
  },
  paragraph: {
    color: C.fg,
    marginTop: 0,
    marginBottom: SP[2],
  },
  heading1: {
    color: C.fg,
    fontSize: FS.lg,
    fontWeight: FW.bold,
    marginTop: SP[3],
    marginBottom: SP[2],
  },
  heading2: {
    color: C.fg,
    fontSize: FS.base,
    fontWeight: FW.semibold,
    marginTop: SP[2],
    marginBottom: SP[1],
  },
  code_inline: {
    color: C.accentBright,
    backgroundColor: C.surface3,
    fontFamily: "Menlo",
    fontSize: FS.xs,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  code_block: {
    color: C.fg,
    backgroundColor: C.surface3,
    fontFamily: "Menlo",
    fontSize: FS.xs,
    padding: SP[2],
    borderRadius: RD.md,
    marginVertical: SP[1],
  },
  fence: {
    color: C.fg,
    backgroundColor: C.surface3,
    fontFamily: "Menlo",
    fontSize: FS.xs,
    padding: SP[2],
    borderRadius: RD.md,
    marginVertical: SP[2],
  },
  link: {
    color: C.accentBright,
    textDecorationLine: "underline" as const,
  },
  list_item: {
    color: C.fgMuted,
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: SP[1],
  },
  strong: {
    color: C.fg,
    fontWeight: FW.semibold,
  },
  em: {
    color: C.fg,
    fontStyle: "italic" as const,
  },
  blockquote: {
    backgroundColor: C.surface1,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: SP[2],
    paddingVertical: SP[1],
    marginVertical: SP[1],
  },
};
