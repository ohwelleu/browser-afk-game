import type { Point, SpriteDef } from './types';

// Gear: ring and pendant icons plus the tier frames they sit in
// (docs/design/active-play.md, section 2). Art only, no game logic.
//
// How to draw one item: draw the tier frame (16×16), then the item icon
// (12×12) on top at ITEM_ICON_OFFSET. The 1 px gap between the frame and
// the icon keeps them from merging. The S sparkles sit in that gap and in
// the icon's empty corners, so they show around any icon.
//
// Colours are existing palette slots for now: C fg, B blue, A purple,
// S yellow + orange. The palette task picks the final rarity colours.

export type ItemTier = 'C' | 'B' | 'A' | 'S';
export type ItemSlot = 'ring' | 'pendant';

/** Where the 12×12 icon goes inside a 16×16 frame. */
export const ITEM_ICON_OFFSET: Point = { x: 2, y: 2 };

/** Ring, 12×12: gold band with a red gem. */
export const itemRing: SpriteDef = {
  name: 'item-ring',
  width: 12,
  height: 12,
  frames: [
    [
      '....RRRR....',
      '...RKRRRR...',
      '....RRRR....',
      '.....YY.....',
      '...OYYYYO...',
      '..OY....YO..',
      '.OY......YO.',
      '.OY......YO.',
      '.OY......YO.',
      '..OY....YO..',
      '...OYYYYO...',
      '....OOOO....',
    ],
  ],
};

/** Pendant, 12×12: chain with a green gem in a gold setting. */
export const itemPendant: SpriteDef = {
  name: 'item-pendant',
  width: 12,
  height: 12,
  frames: [
    [
      '#..........#',
      '.#........#.',
      '..#......#..',
      '...#....#...',
      '....#..#....',
      '.....YY.....',
      '....YGGY....',
      '...YGGGGY...',
      '...YGGGGY...',
      '...YGGGGY...',
      '....YGGY....',
      '.....YY.....',
    ],
  ],
};

/** Tier C frame: plain fg outline. */
export const itemFrameC: SpriteDef = {
  name: 'item-frame-c',
  width: 16,
  height: 16,
  frames: [
    [
      '.##############.',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '.##############.',
    ],
  ],
};

/** Tier B frame: blue outline with filled corners. */
export const itemFrameB: SpriteDef = {
  name: 'item-frame-b',
  width: 16,
  height: 16,
  frames: [
    [
      '.BBBBBBBBBBBBBB.',
      'BB............BB',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'B..............B',
      'BB............BB',
      '.BBBBBBBBBBBBBB.',
    ],
  ],
};

/** Tier A frame: purple outline, corner brackets, gold studs on each side. */
export const itemFrameA: SpriteDef = {
  name: 'item-frame-a',
  width: 16,
  height: 16,
  frames: [
    [
      '.PPPPPPYYPPPPPP.',
      'PPP..........PPP',
      'PP............PP',
      'P..............P',
      'P..............P',
      'P..............P',
      'P..............P',
      'Y..............Y',
      'Y..............Y',
      'P..............P',
      'P..............P',
      'P..............P',
      'P..............P',
      'PP............PP',
      'PPP..........PPP',
      '.PPPPPPYYPPPPPP.',
    ],
  ],
};

/**
 * Tier S frame: gold outline with orange corner brackets. Animated: four
 * orange glints run around the border (the glow) and a star twinkles in the
 * bottom corners, then the outer corners flash.
 */
export const itemFrameS: SpriteDef = {
  name: 'item-frame-s',
  width: 16,
  height: 16,
  fps: 10,
  frames: [
    [
      '.OOYYYYYYYYYYYY.',
      'YOO..........OOO',
      'YO............OO',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'OO...........YOY',
      'OOO..........OOY',
      '.YYYYYYYYYYYYOO.',
    ],
    [
      '.YYOOYYYYYYYYYY.',
      'YOO..........OOY',
      'YO............OY',
      'Y..............O',
      'Y..............O',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'O..............Y',
      'O............Y.Y',
      'YO..........YYYY',
      'YOO..........YOY',
      '.YYYYYYYYYYOOYY.',
    ],
    [
      '.YYYYOOYYYYYYYY.',
      'YOO..........OOY',
      'YO............OY',
      'Y..............Y',
      'Y..............Y',
      'Y..............O',
      'Y..............O',
      'Y..............Y',
      'Y..............Y',
      'O..............Y',
      'O..............Y',
      'Y..............Y',
      'Y..............Y',
      'YO...........YOY',
      'YOO..........OOY',
      '.YYYYYYYYOOYYYY.',
    ],
    [
      '.YYYYYYOOYYYYYY.',
      'YOO..........OOY',
      'YO............OY',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'O..............O',
      'O..............O',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'YOY...........OY',
      'YOO..........OOY',
      '.YYYYYYOOYYYYYY.',
    ],
    [
      '.YYYYYYYYOOYYYY.',
      'YOO..........OOY',
      'YO............OY',
      'Y..............Y',
      'Y..............Y',
      'O..............Y',
      'O..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............O',
      'Y..............O',
      'Y..............Y',
      'Y.Y............Y',
      'YYYY..........OY',
      'YOY..........OOY',
      '.YYYYOOYYYYYYYY.',
    ],
    [
      '.YYYYYYYYYYOOYY.',
      'YOO..........OOY',
      'YO............OY',
      'O..............Y',
      'O..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............O',
      'Y..............O',
      'YOY...........OY',
      'YOO..........OOY',
      '.YYOOYYYYYYYYYY.',
    ],
    [
      '.YYYYYYYYYYYYOOY',
      'OOO..........OOY',
      'OO............OY',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'Y..............Y',
      'YO............OO',
      'YOO..........OOO',
      'YOOYYYYYYYYYYYY.',
    ],
  ],
};

/** Empty slot: dashed fg outline, same size as the tier frames. */
export const itemSlotEmpty: SpriteDef = {
  name: 'item-slot-empty',
  width: 16,
  height: 16,
  frames: [
    [
      '.####..##..####.',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '................',
      '................',
      '#..............#',
      '#..............#',
      '................',
      '................',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '.####..##..####.',
    ],
  ],
};

export const itemIcons = {
  ring: itemRing,
  pendant: itemPendant,
} satisfies Record<ItemSlot, SpriteDef>;

export const itemFrames = {
  C: itemFrameC,
  B: itemFrameB,
  A: itemFrameA,
  S: itemFrameS,
} satisfies Record<ItemTier, SpriteDef>;
