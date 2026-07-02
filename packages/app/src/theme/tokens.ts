/**
 * Color tokens — pixel-sampled from screenshots (visual-spec.md, 2026-07-02).
 *
 * CRITICAL: previous attempt hallucinated "dark theme + purple accent
 * #B3A1FF". Actual screenshots are LIGHT theme with DARK GREEN accent
 * (#307040 paseo teal-green) and BLACK primary buttons (#101010).
 * Sampled via Python PIL on the source JPGs — every value below has
 * a quantized-pixel-count evidence trail in visual-spec.md.
 */
export const C = {
  // ── Backgrounds (LIGHT theme) ──────────────────────────────────────
  bg: "#FFFFFF",           // main canvas (1/2/3/5/6/7/8.2 sampled)
  surface1: "#F4F4F4",     // sidebar, card hover, input fill
  surface2: "#EBEBEB",     // footer, dividers, chip hover
  surface3: "#E0E0E0",     // borders, hairlines
  surfaceSidebar: "#F4F4F4", // sidebar = surface1 (off-white)

  // ── Foreground text ────────────────────────────────────────────────
  fg: "#181818",           // primary text (top bar, titles, body)
  fgMuted: "#404040",      // secondary text (project rows in sidebar)
  fgSubtle: "#707070",     // tertiary text (metadata, subtitles)
  fgFaint: "#A0A0A0",      // placeholder text (inputs)

  // ── Accent — paseo dark green (NOT purple) ─────────────────────────
  accent: "#307040",       // "Jarvis" title, selected-state border, status done
  accentHover: "#3B6C4D",  // hover (lighter green from anti-alias)
  accentDim: "#4F8E5C",    // pressed/soft
  accentForeground: "#FFFFFF", // text on accent fill

  // ── Primary button (BLACK) ─────────────────────────────────────────
  btnPrimary: "#101010",   // "Pair new server", "Apply", "Create", send icon
  btnPrimaryFg: "#FFFFFF",
  btnPrimaryHover: "#2A2A2A",

  // ── Secondary button / chip ───────────────────────────────────────
  btnSecondary: "#F4F4F4",
  btnSecondaryFg: "#181818",

  // ── Borders ────────────────────────────────────────────────────────
  border: "#E0E0E0",
  borderSubtle: "#F0F0F0",

  // ── Status (conventional, see visual-spec.md §4 UNVERIFIED) ───────
  statusOnline: "#3B6C4D", // = accentHover (paseo green)
  statusBusy: "#D97706",   // Tailwind amber-600
  statusError: "#DC2626",  // Tailwind red-600
  statusIdle: "#A0A0A0",

  // ── Destructive ────────────────────────────────────────────────────
  destructive: "#DC2626",  // = statusError; delete buttons, error bars

  // ── Overlays ───────────────────────────────────────────────────────
  backdrop: "rgba(0,0,0,0.5)", // modal backdrop (sampled ~#808080 ≈ 50%)
  scrim: "rgba(0,0,0,0.3)",
} as const;

export type ColorToken = keyof typeof C;
