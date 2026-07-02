/**
 * Radius scale — extracted from screenshots.
 *
 *  - Composer input + message bubbles: 24px (capsule-ish)
 *  - Cards / sheets / buttons: 12-16px
 *  - Small chips / badges: 9999 (full pill)
 */
export const RD = {
  none: 0,
  xs: 4,        // tight inline tags
  sm: 6,        // small badges
  md: 8,        // list rows, icon buttons (38x38)
  lg: 12,       // buttons, cards
  xl: 16,       // sheets, popovers
  "2xl": 24,    // message bubbles, composer
  full: 9999,   // pills, circular avatars/dots
} as const;
export type RadiusToken = keyof typeof RD;
