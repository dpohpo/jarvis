/**
 * Markdown 渲染器 - 从 paseo components/markdown/renderer.tsx 提取核心部分
 *
 * 源文件: /tmp/paseo-ref/packages/app/src/components/markdown/renderer.tsx (759 行)
 *
 * 当前版本: 简化版 MarkdownRenderer + MarkdownInheritedText
 * TODO: 后续补全 MarkdownPartList, MarkdownDetails, Html-ish 支持
 */
import React, {
  useCallback,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Markdown, {
  MarkdownIt,
  type ASTNode,
  type RenderRules,
} from "react-native-markdown-display";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { C, SP, RD, FS, FW } from "../theme";
import { createMarkdownStyles } from "../styles/markdown-styles";
import { openExternalUrl } from "../utils/open-external-url";
import { MarkdownTextSpan, MarkdownParagraphView } from "./markdown-text";

export type MarkdownStyles = Record<string, TextStyle & ViewStyle & { [key: string]: unknown }>;

interface MarkdownWithStableRendererProps {
  children: ReactNode;
  style: ReturnType<typeof createMarkdownStyles>;
  rules?: RenderRules;
  markdownit?: ReturnType<typeof MarkdownIt>;
  onLinkPress?: (url: string) => boolean;
  allowedImageHandlers?: readonly string[];
  topLevelMaxExceededItem?: ReactNode;
}

const MarkdownWithStableRenderer = Markdown as ComponentType<MarkdownWithStableRendererProps>;
const ThemedMarkdown = withUnistyles(MarkdownWithStableRenderer);

function markdownStyleMapping() {
  return { style: createMarkdownStyles() };
}

const defaultMarkdownParser = MarkdownIt({ typographer: true, linkify: true });
const EMPTY_TEXT_STYLE: TextStyle = {};
const MARKDOWN_LIST_ITEM_CONTENT_FLEX: ViewStyle = { flex: 1, flexShrink: 1, minWidth: 0 };

export interface MarkdownRendererProps {
  text: string;
  compact?: boolean;
  rules?: RenderRules;
  markdownit?: ReturnType<typeof MarkdownIt>;
  onLinkPress?: (url: string) => boolean;
  allowedImageHandlers?: readonly string[];
  topLevelMaxExceededItem?: ReactNode;
  enableHtmlish?: boolean;
}

export function MarkdownRenderer({
  text,
  compact = false,
  rules,
  markdownit = defaultMarkdownParser,
  onLinkPress,
  allowedImageHandlers,
  topLevelMaxExceededItem,
  enableHtmlish = true,
}: MarkdownRendererProps) {
  const markdownRules = useMemo(() => rules ?? createSharedMarkdownRules(), [rules]);
  const rendererProps = useMemo(
    () => ({
      compact,
      rules: markdownRules,
      markdownit,
      onLinkPress,
      allowedImageHandlers,
      topLevelMaxExceededItem,
    }),
    [allowedImageHandlers, compact, markdownRules, markdownit, onLinkPress, topLevelMaxExceededItem],
  );

  return (
    <ThemedMarkdown
      uniProps={markdownStyleMapping()}
      rules={markdownRules}
      markdownit={markdownit}
      onLinkPress={onLinkPress}
      allowedImageHandlers={allowedImageHandlers}
      topLevelMaxExceededItem={topLevelMaxExceededItem}
    >
      {text}
    </ThemedMarkdown>
  );
}

interface MarkdownInheritedTextProps {
  inheritedStyles: TextStyle;
  textStyle: TextStyle;
  style?: TextStyle;
  monoSurface?: boolean;
  onPress?: TextProps["onPress"];
  accessibilityRole?: TextProps["accessibilityRole"];
  children: ReactNode;
}

export function MarkdownInheritedText({
  inheritedStyles,
  textStyle,
  style: overrideStyle,
  monoSurface,
  onPress,
  accessibilityRole,
  children,
}: MarkdownInheritedTextProps) {
  const style = useMemo(
    () => [inheritedStyles, textStyle, overrideStyle],
    [inheritedStyles, textStyle, overrideStyle],
  );
  return (
    <MarkdownTextSpan
      monoSurface={monoSurface}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      style={style}
    >
      {children}
    </MarkdownTextSpan>
  );
}

interface MarkdownListItemContentProps {
  contentStyle: ViewStyle;
  children: ReactNode;
}

function MarkdownListItemContent({ contentStyle, children }: MarkdownListItemContentProps) {
  const style = useMemo(() => [contentStyle, MARKDOWN_LIST_ITEM_CONTENT_FLEX], [contentStyle]);
  return <View style={style}>{children}</View>;
}

interface MarkdownListViewProps {
  baseStyle: ViewStyle;
  spacing: { marginTop: number; marginBottom: number };
  children: ReactNode;
}

function MarkdownListView({ baseStyle, spacing, children }: MarkdownListViewProps) {
  const style = useMemo(() => [baseStyle, spacing], [baseStyle, spacing]);
  return <View style={style}>{children}</View>;
}

interface SharedMarkdownLinkProps {
  href: string;
  inheritedStyles: TextStyle;
  linkStyle: TextStyle;
  onLinkPress?: (url: string) => boolean;
  children: ReactNode;
}

function SharedMarkdownLink({
  href,
  inheritedStyles,
  linkStyle,
  onLinkPress,
  children,
}: SharedMarkdownLinkProps) {
  const handlePress = useCallback(() => {
    if (!href) return;
    if (onLinkPress?.(href) === false) return;
    void openExternalUrl(href);
  }, [href, onLinkPress]);

  return (
    <MarkdownInheritedText
      inheritedStyles={inheritedStyles}
      textStyle={linkStyle}
      accessibilityRole="link"
      onPress={handlePress}
    >
      {children}
    </MarkdownInheritedText>
  );
}

function getMarkdownLinkHref(node: ASTNode): string {
  const href = node.attributes?.href;
  return typeof href === "string" ? href : "";
}

export function createSharedMarkdownRules(): RenderRules {
  return {
    text: (
      node: ASTNode,
      _children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText
        key={node.key}
        inheritedStyles={inheritedStyles}
        textStyle={styles.text}
      >
        {node.content}
      </MarkdownInheritedText>
    ),
    textgroup: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText
        key={node.key}
        inheritedStyles={inheritedStyles}
        textStyle={styles.textgroup}
      >
        {children}
      </MarkdownInheritedText>
    ),
    strong: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText
        key={node.key}
        inheritedStyles={inheritedStyles}
        textStyle={styles.strong}
      >
        {children}
      </MarkdownInheritedText>
    ),
    em: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText key={node.key} inheritedStyles={inheritedStyles} textStyle={styles.em}>
        {children}
      </MarkdownInheritedText>
    ),
    s: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText key={node.key} inheritedStyles={inheritedStyles} textStyle={styles.s}>
        {children}
      </MarkdownInheritedText>
    ),
    hardbreak: (node: ASTNode) => <MarkdownTextSpan key={node.key}>{"\n"}</MarkdownTextSpan>,
    softbreak: (node: ASTNode) => <MarkdownTextSpan key={node.key}>{"\n"}</MarkdownTextSpan>,
    code_inline: (
      node: ASTNode,
      _children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      inheritedStyles: TextStyle = {},
    ) => (
      <MarkdownInheritedText
        key={node.key}
        inheritedStyles={inheritedStyles}
        textStyle={styles.code_inline}
        monoSurface
      >
        {node.content ?? ""}
      </MarkdownInheritedText>
    ),
    bullet_list: (
      node: ASTNode,
      children: ReactNode[],
      parent: ASTNode[],
      styles: MarkdownStyles,
    ) => (
      <MarkdownListView
        key={node.key}
        baseStyle={styles.bullet_list}
        spacing={{ marginTop: 8, marginBottom: 8 }}
      >
        {children}
      </MarkdownListView>
    ),
    ordered_list: (
      node: ASTNode,
      children: ReactNode[],
      parent: ASTNode[],
      styles: MarkdownStyles,
    ) => (
      <MarkdownListView
        key={node.key}
        baseStyle={styles.ordered_list}
        spacing={{ marginTop: 8, marginBottom: 8 }}
      >
        {children}
      </MarkdownListView>
    ),
    list_item: (
      node: ASTNode,
      children: ReactNode[],
      parent: ASTNode[],
      styles: MarkdownStyles,
    ) => {
      const isOrdered = Array.isArray(parent) && parent.some((p) => p?.type === "ordered_list");
      const marker = isOrdered ? "1." : "•";
      const iconStyle = isOrdered ? styles.ordered_list_icon : styles.bullet_list_icon;
      const contentStyle = isOrdered ? styles.ordered_list_content : styles.bullet_list_content;

      return (
        <View key={node.key} style={styles.list_item}>
          <Text style={iconStyle}>{marker}</Text>
          <MarkdownListItemContent contentStyle={contentStyle}>{children}</MarkdownListItemContent>
        </View>
      );
    },
    paragraph: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
    ) => (
      <MarkdownParagraphView
        key={node.key}
        paragraphStyle={styles.paragraph}
        containsImage={false}
      >
        {children}
      </MarkdownParagraphView>
    ),
    link: (
      node: ASTNode,
      children: ReactNode[],
      _parent: ASTNode[],
      styles: MarkdownStyles,
      onLinkPress?: (url: string) => boolean,
    ) => (
      <SharedMarkdownLink
        key={node.key}
        href={getMarkdownLinkHref(node)}
        inheritedStyles={EMPTY_TEXT_STYLE}
        linkStyle={styles.link}
        onLinkPress={onLinkPress}
      >
        {children}
      </SharedMarkdownLink>
    ),
  };
}
