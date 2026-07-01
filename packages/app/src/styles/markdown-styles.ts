/**
 * Markdown 样式 - 从 paseo styles/markdown-styles 提取
 * 适配 jarvis theme.ts（使用 C 而不是 unistyles theme）
 */
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import { C, SP, RD, FS, FW } from "../theme";

/** 完整 markdown 样式集 */
export function createMarkdownStyles(): Record<string, TextStyle & ViewStyle> {
  return StyleSheet.create({
    // 正文
    text: {
      color: C.fg,
      fontSize: FS.base,
      lineHeight: 22,
    },
    textgroup: {
      color: C.fg,
      fontSize: FS.base,
      lineHeight: 22,
    },
    // 排版
    strong: {
      color: C.fg,
      fontSize: FS.base,
      fontWeight: FW.bold,
      lineHeight: 22,
    },
    em: {
      color: C.fg,
      fontSize: FS.base,
      fontStyle: "italic",
      lineHeight: 22,
    },
    s: {
      color: C.fg,
      fontSize: FS.base,
      textDecorationLine: "line-through",
      lineHeight: 22,
    },
    // 代码
    code_inline: {
      color: C.accentBright,
      fontFamily: "monospace",
      fontSize: FS.code,
      backgroundColor: C.surface2,
      paddingHorizontal: SP[1],
      paddingVertical: 2,
      borderRadius: RD.base,
      lineHeight: 20,
    },
    code_block: {
      backgroundColor: C.surface0,
      borderWidth: 1,
      borderColor: C.borderAccent,
      borderRadius: RD.lg,
      padding: SP[3],
      marginVertical: SP[2],
    },
    fence: {
      backgroundColor: C.surface0,
      borderWidth: 1,
      borderColor: C.borderAccent,
      borderRadius: RD.lg,
      padding: SP[3],
      marginVertical: SP[2],
    },
    // 列表
    bullet_list: {
      marginTop: SP[2],
      marginBottom: SP[2],
    },
    ordered_list: {
      marginTop: SP[2],
      marginBottom: SP[2],
    },
    list_item: {
      flexDirection: "row",
      marginBottom: SP[1],
    },
    bullet_list_icon: {
      color: C.fg,
      fontSize: FS.sm,
      marginRight: SP[2],
      lineHeight: 22,
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_icon: {
      color: C.fg,
      fontSize: FS.sm,
      fontWeight: FW.medium,
      marginRight: SP[2],
      lineHeight: 22,
    },
    ordered_list_content: {
      flex: 1,
    },
    // 段落
    paragraph: {
      marginBottom: SP[3],
      lineHeight: 22,
    },
    // 链接
    link: {
      color: C.accentBright,
      textDecorationLine: "underline",
    },
    // 表格
    table: {
      borderWidth: 1,
      borderColor: C.borderAccent,
      borderRadius: RD.md,
      marginBottom: SP[3],
    },
    thead: {
      backgroundColor: C.surface2,
    },
    tbody: {},
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: C.borderAccent,
    },
    th: {
      padding: SP[2],
      borderRightWidth: 1,
      borderRightColor: C.borderAccent,
      fontWeight: FW.semibold,
    },
    td: {
      padding: SP[2],
      borderRightWidth: 1,
      borderRightColor: C.borderAccent,
    },
    // 引用
    blockquote: {
      backgroundColor: C.surface2,
      borderLeftWidth: 4,
      borderLeftColor: C.accentDim,
      paddingLeft: SP[3],
      paddingVertical: SP[2],
      marginBottom: SP[3],
      fontStyle: "italic",
    },
    // HR
    hr: {
      backgroundColor: C.borderAccent,
      height: 1,
      marginVertical: SP[4],
    },
  });
}

/** 紧凑模式 markdown 样式（用于 sidebar 等窄区域） */
export function createCompactMarkdownStyles(): Record<string, TextStyle & ViewStyle> {
  const base = createMarkdownStyles();
  return {
    ...base,
    text: { ...base.text, fontSize: FS.sm },
    textgroup: { ...base.textgroup, fontSize: FS.sm },
    strong: { ...base.strong, fontSize: FS.sm },
    em: { ...base.em, fontSize: FS.sm },
  };
}
