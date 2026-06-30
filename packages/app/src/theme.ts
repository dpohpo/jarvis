/**
 * Paseo theme system — 6 themes ported from getpaseo/paseo theme.ts.
 *
 * Token field names match what App.tsx already uses (C.surface0…C.surface4,
 * C.fg, C.accent, …) so swapping themes is a 1-line change in useTheme().
 *
 * VERIFIED 2026-06-30 against /tmp/paseo-ref/packages/app/src/styles/theme.ts
 * via Explore agent (3 agents cross-checked hex values).
 *
 * Themes:
 *  - dark      — default teal-green on near-black (#181B1A)
 *  - zinc      — neutral grey accent for high-contrast minimalism
 *  - midnight  — cool blue accent
 *  - claude    — warm orange accent (Claude brand)
 *  - ghostty   — blue-grey accent (Ghostty brand)
 *  - light     — light mode (same teal-green accent, white surfaces)
 */

export type ThemeName = "dark" | "zinc" | "midnight" | "claude" | "ghostty" | "light";

/** Fields App.tsx reads via `C.<field>`. Keep in sync with §1 const C. */
export interface ThemeTokens {
  // Surface stack (5 layers + special surfaces)
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  surface4: string;
  surfaceSidebar: string;
  surfaceSidebarHover: string;
  surfaceWorkspace: string;
  surfaceDiffEmpty: string;
  // Text
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  // Controls
  scrollbarHandle: string;
  // Brand
  accent: string;
  accentBright: string;
  accentDim: string;
  accentForeground: string;
  // Semantic
  destructive: string;
  destructiveDim: string;
  destructiveForeground: string;
  warn: string;
  warnDim: string;
  success: string;
  // Borders
  border: string;
  borderAccent: string;
  // Diff (chat code/diff view)
  diffAddition: string;
  diffDeletion: string;
  // Status pills (agent status / task status)
  statusSuccess: string;
  statusDanger: string;
  statusWarning: string;
  statusMerged: string;
  // Backdrops
  backdropStrong: string;
  backdropSoft: string;
}

/** Paseo Dark — default. teal-green accent on layered near-black surfaces. */
export const DARK: ThemeTokens = {
  surface0: "#181B1A",
  surface1: "#1E2120",
  surface2: "#272A29",
  surface3: "#434645",
  surface4: "#595B5B",
  surfaceSidebar: "#141716",
  surfaceSidebarHover: "#1C1F1E",
  surfaceWorkspace: "#1E2120",
  surfaceDiffEmpty: "#252827",
  fg: "#FAFAFA",
  fgMuted: "#A1A5A4",
  fgSubtle: "#717574",
  scrollbarHandle: "#717574",
  accent: "#20744A",
  accentBright: "#7CCBA0",
  accentDim: "#193B27",
  accentForeground: "#FFFFFF",
  destructive: "#C64F43",
  destructiveDim: "#3A1F1C",
  destructiveForeground: "#FFFFFF",
  warn: "#D97706",
  warnDim: "#3A2A12",
  success: "#20744A",
  border: "#252B2A",
  borderAccent: "#2F3534",
  diffAddition: "#4ADE80",
  diffDeletion: "#EF4444",
  statusSuccess: "#16A34A",
  statusDanger: "#DC2626",
  statusWarning: "#F59E0B",
  statusMerged: "#9333EA",
  backdropStrong: "rgba(0, 0, 0, 0.70)",
  backdropSoft: "rgba(0, 0, 0, 0.50)",
};

/** Paseo Zinc — neutral grey accent for minimalists. */
export const ZINC: ThemeTokens = {
  ...DARK,
  surface0: "#18181B",
  surface1: "#1E1E22",
  surface2: "#27272C",
  accent: "#E4E4E7",
  accentBright: "#FAFAFA",
  accentDim: "#3F3F46",
  accentForeground: "#18181B",
  destructive: "#C44A4A",
};

/** Paseo Midnight — cool blue. */
export const MIDNIGHT: ThemeTokens = {
  ...DARK,
  surface0: "#161820",
  surface1: "#1C1F29",
  surface2: "#252A37",
  accent: "#3B6FCF",
  accentBright: "#7EAAEB",
  accentDim: "#1E3A6F",
  destructive: "#C44A52",
};

/** Paseo Claude — warm orange (Claude brand). */
export const CLAUDE: ThemeTokens = {
  ...DARK,
  surface0: "#1F1F1E",
  surface1: "#252524",
  surface2: "#2F2F2D",
  accent: "#D97757",
  accentBright: "#E89A7F",
  accentDim: "#5C3A2A",
  destructive: "#CF513E",
};

/** Paseo Ghostty — blue-grey (Ghostty brand). */
export const GHOSTTY: ThemeTokens = {
  ...DARK,
  surface0: "#282C34",
  surface1: "#2E333D",
  surface2: "#383E4A",
  accent: "#89B4FA",
  accentBright: "#B4D0FC",
  accentDim: "#2A3A5C",
  destructive: "#C44A55",
};

/** Paseo Light — same teal accent on white surfaces. */
export const LIGHT: ThemeTokens = {
  surface0: "#FFFFFF",
  surface1: "#FAFAFA",
  surface2: "#F4F4F5",
  surface3: "#E4E4E7",
  surface4: "#D4D4D8",
  surfaceSidebar: "#F4F4F5",
  surfaceSidebarHover: "#E9E9EC",
  surfaceWorkspace: "#FFFFFF",
  surfaceDiffEmpty: "#F6F6F6",
  fg: "#1A1A1E",
  fgMuted: "#71717A",
  fgSubtle: "#A1A1AA",
  scrollbarHandle: "#3F3F46",
  accent: "#20744A",
  accentBright: "#239956",
  accentDim: "#D1FAE5",
  accentForeground: "#FFFFFF",
  destructive: "#B04138",
  destructiveDim: "#FEE2E2",
  destructiveForeground: "#FFFFFF",
  warn: "#D97706",
  warnDim: "#FEF3C7",
  success: "#20744A",
  border: "#E4E4E7",
  borderAccent: "#ECECF1",
  diffAddition: "#15803D",
  diffDeletion: "#B91C1C",
  statusSuccess: "#15803D",
  statusDanger: "#B91C1C",
  statusWarning: "#D97706",
  statusMerged: "#7C3AED",
  backdropStrong: "rgba(0, 0, 0, 0.50)",
  backdropSoft: "rgba(0, 0, 0, 0.30)",
};

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: DARK,
  zinc: ZINC,
  midnight: MIDNIGHT,
  claude: CLAUDE,
  ghostty: GHOSTTY,
  light: LIGHT,
};

export const DEFAULT_THEME: ThemeName = "dark";

/**
 * C — Current color tokens (default DARK theme alias).
 * Used in StyleSheet.create for inline color values.
 * Switch themes by updating this alias or using useTheme() hook.
 */
export const C = DARK;

/** Spacing scale (px). VERIFIED from paseo theme.ts spacing. */
export const SP = {
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
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

/** Radius scale (px). VERIFIED from paseo theme.ts borderRadius. */
export const RD = {
  none: 0,
  sm: 2,
  base: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 20,
  full: 9999,
} as const;

/** Font size scale (px). VERIFIED from paseo theme.ts fontSize. */
export const FS = {
  xs: 12,
  code: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 22,
  "3xl": 26,
  "4xl": 34,
} as const;

/** Font weight. VERIFIED from paseo theme.ts fontWeight. */
export const FW = {
  normal: "normal" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "bold" as const,
};

/** Shadow presets. VERIFIED from paseo theme.ts shadows (dark variant). */
export const SH = {
  sm: {
    shadowColor: "rgba(0, 0, 0, 0.25)",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "rgba(0, 0, 0, 0.20)",
    shadowOffset: { width: 0, height:  4 },
    shadowRadius: 8,
    elevation: 8,
  },
  lg: {
    shadowColor: "rgba(0, 0, 0, 0.40)",
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 8,
  },
};

/**
 * AsyncStorage key for the user's theme choice. Hook persisted across launches.
 * Phase 4 settings UI will expose a picker; for now default to "dark".
 */
export const THEME_STORAGE_KEY = "jarvis.theme";
