/**
 * Typography scale — font-size + font-weight tokens.
 *
 * Extracted from screenshots:
 *  - Login title "Jarvis" (becomes "Jarvis"): 32px bold
 *  - Header workspace name: 16px semibold
 *  - Body / message text: 14-15px regular
 *  - Section headers (PROJECTS / SESSIONS): 11px semibold uppercase
 *  - Timestamps / hints: 11px regular
 */
export const FS = {
  xs: 11,     // timestamps, hints, section headers (with uppercase)
  sm: 13,     // metadata, secondary text
  base: 15,   // body text, message content
  lg: 17,     // screen titles, modal headers
  xl: 20,     // emphasized titles
  "2xl": 24,  // large titles
  "3xl": 32,  // login brand title
} as const;
export type FontSize = keyof typeof FS;

export const FW = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
export type FontWeight = keyof typeof FW;

/** Line height multipliers — message bubbles use 1.4 for readability. */
export const LH = {
  tight: 1.2,    // titles
  base: 1.4,     // body / message text
  relaxed: 1.6,  // long-form assistant markdown
} as const;
export type LineHeight = keyof typeof LH;

/** Letter spacing — titles get slight tracking. */
export const LS = {
  none: 0,
  tight: -0.5,
  wide: 1,       // section headers (uppercase)
  brand: 2,      // login title brand spacing
} as const;
export type LetterSpacing = keyof typeof LS;
