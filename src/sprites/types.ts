/**
 * Sprite format shared with the art thread.
 *
 * Each frame is an array of strings, one string per row and one char per
 * pixel. Palette slots:
 *   `.` transparent, `#` fg, `o` bg,
 *   `O` orange, `Y` yellow, `R` red, `P` purple, `G` green, `B` blue, `K` pink
 */
export type SpriteDef = {
  name: string;
  width: number;
  height: number;
  frames: string[][];
  /** Animation speed in frames per second. Omit for a still sprite. */
  fps?: number;
};
