/**
 * Theme barrel export — single import surface for the whole app.
 *
 * Usage:
 *   import { C, SP, FS, FW, LH, LS, RD, SHADOWS } from "../theme";
 *
 * Do NOT import from individual token files — keep the API surface flat
 * so we can later swap to a generated palette without touching call sites.
 */
export { C } from "./tokens";
export type { ColorToken } from "./tokens";

export { SP } from "./spacing";
export type { SpacingToken } from "./spacing";

export { FS, FW, LH, LS } from "./typography";
export type { FontSize, FontWeight, LineHeight, LetterSpacing } from "./typography";

export { RD } from "./radius";
export type { RadiusToken } from "./radius";

export { SHADOWS } from "./shadows";
export type { ShadowToken } from "./shadows";
