import { StyleSheet } from "react-native-unistyles";
import { DARK, LIGHT } from "./src/theme";

// 完整主题配置 - 从 paseo 提取完整 token 集
const lightTheme = {
  colors: {
    ...LIGHT,
    // 扁平化访问（兼容 paseo @getpaseo/styles/theme 结构）
    foreground: LIGHT.fg,
    foregroundMuted: LIGHT.fgMuted,
    background: LIGHT.surface0,
    border: LIGHT.border,
  },
  spacing: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
  },
  fontSize: {
    xs: 12,
    code: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
  },
  fontWeight: {
    normal: "normal" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "bold" as const,
  },
  borderRadius: {
    none: 0,
    sm: 2,
    base: 4,
    md: 6,
    lg: 8,
    xl: 12,
    "2xl": 16,
  },
  opacity: {
    50: 0.5,
  },
};

const darkTheme = {
  colors: {
    ...DARK,
    foreground: DARK.fg,
    foregroundMuted: DARK.fgMuted,
    background: DARK.surface0,
    border: DARK.border,
  },
  spacing: lightTheme.spacing,
  fontSize: lightTheme.fontSize,
  fontWeight: lightTheme.fontWeight,
  borderRadius: lightTheme.borderRadius,
  opacity: lightTheme.opacity,
};

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
  },
  // 添加 spacing 索引签名
  plugins: [],
});

// Type augmentation for TypeScript
interface AppThemes {
  light: typeof lightTheme;
  dark: typeof darkTheme;
}

interface AppBreakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}
