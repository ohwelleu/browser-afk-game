/**
 * Sprite format shared by the art and the renderer.
 *
 * Each frame is an array of rows, one char per pixel. Palette slots:
 *
 *   .  transparent
 *   #  fg (theme foreground)
 *   o  bg (theme background: eyes, cut-outs, highlights inside a silhouette)
 *   O Y R P G B K  orange, yellow, red, purple, green, blue, pink
 *
 * Every row is exactly `width` chars and every frame has exactly `height`
 * rows. The same slots map 1:1 to an indexed PNG palette (Piskel/Aseprite),
 * so sheets can be converted either way.
 */
export type SpriteDef = {
  name: string;
  width: number;
  height: number;
  frames: string[][];
  fps?: number;
};

/** Palette slots in index order (index 0 = transparent), e.g. for indexed PNG export. */
export const PALETTE_SLOTS = ['.', '#', 'o', 'O', 'Y', 'R', 'P', 'G', 'B', 'K'] as const;
export type PaletteSlot = (typeof PALETTE_SLOTS)[number];

export type Point = { x: number; y: number };

/**
 * Weapon orientations. Pixel art does not rotate well, so every weapon tier
 * is drawn once per pose instead of being rotated at runtime.
 *
 *   up       blade straight up
 *   upFwd    blade up and forward (45°)
 *   fwd      blade straight forward (to the right)
 *   downFwd  blade down and forward (45°)
 *   back     blade straight back (to the left), with a bg outline so it reads
 *            when it crosses the coat
 */
export type WeaponPose = 'up' | 'upFwd' | 'fwd' | 'downFwd' | 'back';

export type WeaponPoseDef = {
  /** Single-frame sprite of the weapon in this pose. */
  sprite: SpriteDef;
  /** Pixel inside `sprite` that sits in the hero's hand. */
  grip: Point;
};

export type WeaponDef = {
  name: string;
  /** 0 = Stick … 4 = Gold sword, matches the shop order. */
  tier: number;
  poses: Record<WeaponPose, WeaponPoseDef>;
};

/**
 * Where the weapon goes on one hero frame. Draw the weapon pose sprite so
 * that its `grip` pixel lands on (`x`, `y`) of the hero frame.
 * `behind: true` means draw it before the hero, otherwise after.
 * `null` means no weapon on this frame.
 */
export type WeaponAnchor = {
  x: number;
  y: number;
  pose: WeaponPose;
  behind?: boolean;
} | null;
