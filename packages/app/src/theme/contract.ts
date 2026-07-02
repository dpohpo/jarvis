/**
 * Contract — runtime assertions on the screenshot-extracted tokens.
 *
 * Why a plain TS contract instead of a jest snapshot:
 *  - jarvis app has no test runner (test script is `echo 'manual: on-device'`)
 *  - installing jest/vitest just for 8 numeric assertions pulls in 200+ deps
 *  - the values are stable (screenshot-extracted) and never change at runtime
 *
 * Importing this module runs the assertions once (guard against accidental
 * token drift). If any assertion fails, the import throws with a clear
 * message naming the offending token.
 *
 * Phase 15装机验证: visual diff against the 14 screenshots is the real
 * snapshot — this contract just stops typos from shipping.
 */
import { C } from "./tokens";
import { SP } from "./spacing";
import { FS, FW, LH, LS } from "./typography";
import { RD } from "./radius";

type Spec = { name: string; got: unknown; want: unknown };
const specs: Spec[] = [
  // Accent — vibrant purple
  { name: "C.accent", got: C.accent, want: "#B3A1FF" },
  { name: "C.accentBright", got: C.accentBright, want: "#D4C5FF" },
  { name: "C.accentDim", got: C.accentDim, want: "#3D2E70" },
  { name: "C.accentForeground", got: C.accentForeground, want: "#1A1A1F" },

  // Canvas — warm dark, NOT paseo teal-green
  { name: "C.bg", got: C.bg, want: "#1A1A1F" },
  { name: "C.surfaceSidebar", got: C.surfaceSidebar, want: "#161619" },

  // 3-layer surface progression
  { name: "C.surface1", got: C.surface1, want: "#232329" },
  { name: "C.surface2", got: C.surface2, want: "#2D2D35" },
  { name: "C.surface3", got: C.surface3, want: "#3A3A44" },

  // Status palette (8.jpg sidebar dots)
  { name: "C.statusOnline", got: C.statusOnline, want: "#4ADE80" },
  { name: "C.statusBusy", got: C.statusBusy, want: "#FBBF24" },
  { name: "C.statusError", got: C.statusError, want: "#F87171" },

  // Spacing scale
  { name: "SP[0]", got: SP[0], want: 0 },
  { name: "SP[1]", got: SP[1], want: 4 },
  { name: "SP[6]", got: SP[6], want: 24 },
  { name: "SP[12] (login logo)", got: SP[12], want: 96 },

  // Typography — login title 32 bold
  { name: "FS.3xl (login title)", got: FS["3xl"], want: 32 },
  { name: "FW.bold", got: FW.bold, want: "700" },

  // Radius — composer/bubble 24
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
    `[theme/contract] token drift detected — re-verify against ~/Desktop/jarvis ui/:\n${msg}`,
  );
}

export const CONTRACT_OK = true;
