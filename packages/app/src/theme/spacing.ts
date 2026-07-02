/**
 * Spacing scale — power-of-two progression with a 0 entry and a few
 * large jumps for section padding.
 *
 * Extracted from screenshots: the visible padding on most cards / buttons
 * lands on multiples of 4. Sheet padding jumps to 24 (SP[5]).
 *
 * Use SP[N] — never hard-code px values in components.
 */
export const SP = [
  0,   // SP[0]
  4,   // SP[1] — tight inline gap
  8,   // SP[2] — default inline gap, chip padding
  12,  // SP[3] — button padding-y, card padding
  16,  // SP[4] — section header padding
  20,  // SP[5] — sheet padding
  24,  // SP[6] — screen edge padding
  32,  // SP[7] — empty-state icon spacing
  40,  // SP[8] — empty-state icon-to-button
  48,  // SP[9]
  64,  // SP[10] — large button size (add-project + button)
  80,  // SP[11] — empty-state icon diameter
  96,  // SP[12] — login logo diameter
] as const;

export type SpacingToken = number; // index into SP[]
