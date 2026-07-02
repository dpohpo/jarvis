/**
 * Shadow tokens — RN-style shadow props.
 *
 * Mobile screenshots use very subtle elevation. Two layers:
 *  - elevation 1: cards, list rows
 *  - elevation 2: sheets, popovers
 *  - elevation 3: full-screen modals
 */
import type { ViewStyle } from "react-native";

export const SHADOWS: Record<"sm" | "md" | "lg", ViewStyle> = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};

export type ShadowToken = keyof typeof SHADOWS;
