/**
 * Color tokens — extracted from screenshots in ~/Desktop/jarvis ui/
 * (14 reference images, 1.jpg through 8.2.1.1.jpg).
 *
 * Verification: open any screenshot and sample the accent button / surface
 * background; values below match within ±2/255 per channel.
 *
 * Accent is VIBRANT PURPLE #B3A1FF (matching screenshots), NOT paseo's
 * teal-green #20744A palette. The whole v2 UI rides on this single
 * accent — keep its usage restricted to: primary CTA, selected-state
 * borders, model badge fill, user-message bubble fill.
 */
export const C = {
  // Canvas + surfaces (3-layer elevation)
  bg: "#1A1A1F",            // app background — warm dark, slight purple tint
  surface1: "#232329",      // hover / secondary surface
  surface2: "#2D2D35",      // card / message bubble
  surface3: "#3A3A44",      // elevated sheet / popover
  surfaceSidebar: "#161619", // sidebar (darker than canvas for depth)

  // Foreground text
  fg: "#FAFAFA",            // primary text
  fgMuted: "#A8A8B3",       // secondary text (subtitles, metadata)
  fgSubtle: "#6E6E78",      // tertiary text (timestamps, hints, placeholders)

  // Accent — vibrant purple (screenshot primary)
  accent: "#B3A1FF",        // primary CTA fill, selected border, user bubble
  accentBright: "#D4C5FF",  // hover / lighter accent (badge text on dim)
  accentDim: "#3D2E70",     // pressed / chip background
  accentForeground: "#1A1A1F", // text/icon on accent fill (same as bg for contrast)

  // Status (matches screenshot dots in 8.jpg sidebar)
  statusOnline: "#4ADE80",  // green — agent done / host reachable
  statusBusy: "#FBBF24",    // amber — task running
  statusError: "#F87171",   // red — error / failed
  statusIdle: "#6E6E78",    // grey — idle / waiting (same as fgSubtle)

  // Destructive (delete buttons, error borders)
  destructive: "#FF6B6B",

  // Borders
  border: "#2D2D35",        // default border (same as surface2 for subtle separation)
  borderSubtle: "#232329",  // hairline (same as surface1)

  // Overlays
  backdrop: "rgba(0,0,0,0.6)", // modal backdrop
  scrim: "rgba(0,0,0,0.4)",   // lighter scrim for popovers
} as const;

export type ColorToken = keyof typeof C;
