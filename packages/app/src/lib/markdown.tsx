import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { DARK } from "../theme";

const SP = { 1: 4, 2: 8, 3: 12 };
const RD = { lg: 8, base: 4 };
const FS = { xs: 12, sm: 14 };
const FW = { semibold: "600" as const };

const C = DARK;

const styles = StyleSheet.create({
  mdList: { marginTop: SP[1], marginBottom: SP[2], gap: SP[1] },
  mdListItem: { flexDirection: "row", gap: SP[2] },
  mdBullet: { color: C.accentBright, fontSize: FS.sm, lineHeight: 22 },
  mdListItemText: { color: C.fg, fontSize: FS.sm, lineHeight: 22, flex: 1 },
  mdBold: { color: C.fg, fontSize: FS.sm, lineHeight: 22, fontWeight: FW.semibold },
  mdInlineCode: {
    color: C.accentBright,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: C.surface0,
    paddingHorizontal: SP[1],
    paddingVertical: 1,
    borderRadius: RD.base,
    fontSize: FS.xs,
    lineHeight: 20,
  },
  mdLink: {
    color: C.accentBright,
    textDecorationLine: "underline",
    fontSize: FS.sm,
    lineHeight: 22,
  },
  mdParagraph: {
    color: C.fg,
    fontSize: FS.sm,
    lineHeight: 22,
    marginBottom: SP[1],
  },
  mdCodeBlock: {
    backgroundColor: C.surface0,
    borderRadius: RD.lg,
    padding: SP[2],
    marginVertical: SP[1],
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  mdCodeText: {
    color: C.accentBright,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: FS.xs,
    lineHeight: 18,
  },
});

/**
 * 轻量级 Markdown 渲染器 - 支持：段落/列表/代码块/inline code/粗体/链接
 * 不引入新依赖，复 paseo 风格渲染规则
 */
export function renderMarkdownLite(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let key = 0;
  let inFence = false;
  let fenceBuf: string[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    nodes.push(
      <View key={`list-${key++}`} style={styles.mdList}>
        {listBuf.map((item, idx) => (
          <View key={`li-${key++}-${idx}`} style={styles.mdListItem}>
            <Text style={styles.mdBullet}>•</Text>
            <Text style={styles.mdListItemText}>{renderInline(item)}</Text>
          </View>
        ))}
      </View>,
    );
    listBuf = [];
  };

  const flushFence = () => {
    if (fenceBuf.length === 0) return;
    nodes.push(
      <View key={`code-${key++}`} style={styles.mdCodeBlock}>
        <Text style={styles.mdCodeText}>{fenceBuf.join("\n")}</Text>
      </View>,
    );
    fenceBuf = [];
  };

  for (const raw of lines) {
    const line = raw;
    // fenced code block
    if (line.trim().startsWith("```")) {
      if (inFence) {
        flushFence();
        inFence = false;
      } else {
        flushList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }
    // bullet list item
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      listBuf.push(bulletMatch[1] ?? "");
      continue;
    }
    flushList();
    if (line.trim().length === 0) {
      nodes.push(<View key={`sp-${key++}`} style={{ height: SP[1] }} />);
      continue;
    }
    nodes.push(
      <Text key={`p-${key++}`} style={styles.mdParagraph}>
        {renderInline(line)}
      </Text>,
    );
  }
  flushList();
  flushFence();
  return nodes;
}

/**
 * Parse **bold**, `code`, and [link](url) within a single line.
 */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    // inline code first (shorter span)
    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      out.push(
        <Text key={`c-${key++}`} style={styles.mdInlineCode}>
          {codeMatch[1]}
        </Text>,
      );
      rest = rest.slice(codeMatch[0].length);
      continue;
    }

    // link [text](url)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      out.push(
        <Text key={`l-${key++}`} style={styles.mdLink}>
          {linkMatch[1]}
        </Text>,
      );
      rest = rest.slice(linkMatch[0].length);
      continue;
    }

    // bold **text**
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      out.push(
        <Text key={`b-${key++}`} style={styles.mdBold}>
          {boldMatch[1]}
        </Text>,
      );
      rest = rest.slice(boldMatch[0].length);
      continue;
    }

    // plain text (take one char at a time to avoid infinite loop)
    if (rest.length > 0) {
      out.push(<Text key={`t-${key++}`}>{rest[0]}</Text>);
      rest = rest.slice(1);
    }
  }

  return out;
}
