/**
 * Contract — runtime assertions on the pixel-sampled tokens.
 *
 * Locks the values sampled via Python PIL on the 14 screenshots.
 * If any value drifts, importing this module throws. Run on app boot
 * to fail fast on accidental palette regressions.
 */
import { C } from "./tokens";
import { SP } from "./spacing";
import { FS, FW, LH, LS } from "./typography";
import { RD } from "./radius";

type Spec = { name: string; got: unknown; want: unknown };
const specs: Spec[] = [
  // Backgrounds — LIGHT theme, NOT dark
  { name: "C.bg", got: C.bg, want: "#FFFFFF" },
  { name: "C.surface1", got: C.surface1, want: "#F4F4F4" },
  { name: "C.surface2", got: C.surface2, want: "#EBEBEB" },
  { name: "C.surface3", got: C.surface3, want: "#E0E0E0" },

  // Foreground — DARK text on LIGHT bg
  { name: "C.fg", got: C.fg, want: "#181818" },
  { name: "C.fgMuted", got: C.fgMuted, want: "#404040" },
  { name: "C.fgSubtle", got: C.fgSubtle, want: "#707070" },
  { name: "C.fgFaint", got: C.fgFaint, want: "#A0A0A0" },

  // Accent — paseo DARK GREEN (was hallucinated as purple #B3A1FF)
  { name: "C.accent", got: C.accent, want: "#307040" },
  { name: "C.accentHover", got: C.accentHover, want: "#3B6C4D" },
  { name: "C.accentDim", got: C.accentDim, want: "#4F8E5C" },

  // Primary button — BLACK (not accent)
  { name: "C.btnPrimary", got: C.btnPrimary, want: "#101010" },
  { name: "C.btnPrimaryFg", got: C.btnPrimaryFg, want: "#FFFFFF" },

  // Status
  { name: "C.statusOnline", got: C.statusOnline, want: "#3B6C4D" },
  { name: "C.statusBusy", got: C.statusBusy, want: "#D97706" },
  { name: "C.statusError", got: C.statusError, want: "#DC2626" },

  // Borders
  { name: "C.border", got: C.border, want: "#E0E0E0" },
  { name: "C.borderSubtle", got: C.borderSubtle, want: "#F0F0F0" },

  // Spacing
  { name: "SP[0]", got: SP[0], want: 0 },
  { name: "SP[1]", got: SP[1], want: 4 },
  { name: "SP[6]", got: SP[6], want: 24 },
  { name: "SP[12] (login logo)", got: SP[12], want: 96 },

  // Typography
  { name: "FS.3xl (login title)", got: FS["3xl"], want: 32 },
  { name: "FW.bold", got: FW.bold, want: "700" },

  // Radius
  { name: "RD.2xl (bubble)", got: RD["2xl"], want: 24 },
  { name: "RD.full (pill)", got: RD.full, want: 9999 },

  // Line height + letter spacing
  { name: "LH.base", got: LH.base, want: 1.4 },
  { name: "LH.relaxed", got: LH.relaxed, want: 1.6 },
  { name: "LS.brand", got: LS.brand, want: 2 },
  { name: "LS.wide", got: LS.wide, want: 1 },
];

const failures = specs.filter((s) => s.got !== s.want);
if (failures.length > 0) {
  const msg = failures
    .map((s) => `  ${s.name}: got ${JSON.stringify(s.got)}, want ${JSON.stringify(s.want)}`)
    .join("\n");
  throw new Error(
    `[theme/contract] token drift detected — see visual-spec.md:\n${msg}`,
  );
}

export const CONTRACT_OK = true;
