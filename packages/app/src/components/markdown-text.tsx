/**
 * Markdown Text 组件 - 从 paseo components/markdown-text.ios.tsx 提取
 *
 * 源文件: /tmp/paseo-ref/packages/app/src/components/markdown-text.ios.tsx
 *
 * 注意：jarvis 未安装 react-native-uitextview，暂时用 Text 代替
 * TODO: 安装 react-native-uitextview 后恢复 UITextView
 */
import { useMemo, type ReactNode } from "react";
import { Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";

interface MarkdownTextSpanProps {
  style?: StyleProp<TextStyle>;
  monoSurface?: boolean;
  children: ReactNode;
  onPress?: TextProps["onPress"];
  accessibilityRole?: TextProps["accessibilityRole"];
}

/**
 * Inline span - 暂时用 Text 代替 UITextView
 * TODO: 安装 react-native-uitextview 后切换到 UITextView
 */
export function MarkdownTextSpan({
  style,
  children,
  onPress,
  accessibilityRole,
}: MarkdownTextSpanProps) {
  const plainStyle = useMemo(() => flattenStyle(style), [style]);

  return (
    <Text
      selectable
      style={plainStyle}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </Text>
  );
}

interface MarkdownParagraphViewProps {
  paragraphStyle: ViewStyle;
  containsImage?: boolean;
  children: ReactNode;
}

const MARKDOWN_PARAGRAPH_RESET: ViewStyle = {};

/**
 * Paragraph wrapper - 暂时用 View/Text 代替 UITextView
 * TODO: 安装 react-native-uitextview 后切换到 UITextView
 */
export function MarkdownParagraphView({
  paragraphStyle,
  containsImage = false,
  children,
}: MarkdownParagraphViewProps) {
  const textStyle = useMemo(
    () => flattenStyle([paragraphStyle, MARKDOWN_PARAGRAPH_RESET]),
    [paragraphStyle],
  );
  const viewStyle = useMemo(() => [paragraphStyle, MARKDOWN_PARAGRAPH_RESET], [paragraphStyle]);

  if (containsImage) {
    return <View style={viewStyle}>{children}</View>;
  }

  return (
    <Text selectable style={textStyle}>
      {children}
    </Text>
  );
}

/**
 * Flatten style and remove unistyles metadata
 */
function flattenStyle(style: StyleProp<TextStyle | ViewStyle>): TextStyle {
  if (!style) return {};
  const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
  const plain: Record<string, unknown> = { ...flattened };
  for (const key of Object.keys(plain)) {
    if (key.startsWith("unistyles_")) {
      delete plain[key];
    }
  }
  return plain as TextStyle;
}
