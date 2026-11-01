import type { Point, SpriteDef } from './types';

// Crow companion (docs/design/active-play.md, section 1). 16�16 on every
// frame, faces right (towards the mob) like the hero; fly-back faces left.
// Ink body (`#`) with a red eye (`R`), so it sits next to the hero's red
// cravat in both themes.
//
// Placement and timing are game logic (separate thread). The art assumes:
// - idle: perched on the ground next to the hero, feet on the bottom row.
// - fly-out / fly-back: loop the wing cycle while moving; flight frames keep
//   the body around rows 6�11 so swapping between them doesn't jump.
// - peck: plays in the air in front of the mob. Damage, the mob's flash and
//   the hit sound land on `hitFrame`; draw `hitEffect` centred on `hitPoint`
//   (the beak tip) on that frame.

const E = '................';

const P0 = [
  E,
  E,
  E,
  E,
  '.........####...',
  '........#######.',
  '........###R####',
  '........######..',
  '.......#######..',
  '......########..',
  '....###o######..',
  '..####o#######..',
  '.####o#######...',
  '####.#######....',
  '##.....#.#......',
  '.......##.##....',
];

const FUP = [
  '.#.#.#..........',
  '.#######........',
  '..#######.......',
  '...######.......',
  '...######.......',
  '....#####.......',
  '....#####.####..',
  '....########R###',
  '.##############.',
  '####.#########..',
  '##...########...',
  '......#####.....',
  E,
  E,
  E,
  E,
];

const FMID = [
  E,
  E,
  E,
  E,
  E,
  E,
  '.#.######.####..',
  '....########R###',
  '.##############.',
  '####.#########..',
  '##...########...',
  '......#####.....',
  E,
  E,
  E,
  E,
];

const FDOWN = [
  E,
  E,
  E,
  E,
  E,
  E,
  '..........####..',
  '....########R###',
  '.##############.',
  '####.#########..',
  '##..#########...',
  '....#####.......',
  '...#####........',
  '...####.........',
  '..#.#.#.........',
  E,
];

const K0 = [
  '.#.#.#..........',
  '.#######........',
  '..#######.......',
  '...######.......',
  '...######.......',
  '....####.####...',
  '...########R###.',
  '.#############..',
  '####.########...',
  '##..########....',
  '......#####.....',
  E,
  E,
  E,
  E,
  E,
];

const K1 = [
  E,
  E,
  '.#.#............',
  '..#####.........',
  '...######.......',
  '##..######......',
  '.###.#######....',
  '..###########...',
  '....##########..',
  '......######R#..',
  '........########',
  '...........####.',
  E,
  E,
  E,
  E,
];

/** Blink: the eye closes. */
const P1 = P0.map((row, y) => (y === 6 ? '........########' : row));

/** Wing half open: the tips lift off the tail. */
const P3 = [
  ...P0.slice(0, 9),
  '..##..########..',
  '...####o######..',
  '..#####o######..',
  '.####.#######...',
  ...P0.slice(13),
];

/** Wing up: a small flap above the back. */
const P2 = [
  E,
  E,
  E,
  '..#.#...........',
  '..#####..####...',
  '...####.#######.',
  '....###.###R####',
  '.....##o######..',
  '.......#######..',
  '......########..',
  '....##########..',
  '..############..',
  '.############...',
  ...P0.slice(13),
];

/** Mirror a right-facing frame so it faces left. */
const mirror = (frame: string[]) => frame.map((row) => [...row].reverse().join(''));

/** Perched next to the hero: breathes, blinks, then a small wing flap. 2 s loop. */
export const crowIdle: SpriteDef = {
  name: 'crow-idle',
  width: 16,
  height: 16,
  fps: 4,
  frames: [P0, P0, P1, P0, P0, P3, P2, P3],
};

/** Flying right to the mob: wings up, level, down, level. Loop while moving. */
export const crowFlyOut: SpriteDef = {
  name: 'crow-fly-out',
  width: 16,
  height: 16,
  fps: 10,
  frames: [FUP, FMID, FDOWN, FMID],
};

/** Peck: wind-up (head back, wings up), strike (hit frame), recover into flight. 0.3 s. */
export const crowPeck: SpriteDef = {
  name: 'crow-peck',
  width: 16,
  height: 16,
  fps: 10,
  frames: [K0, K1, FMID],
};

/** Flying back to the hero: fly-out mirrored to face left. */
export const crowFlyBack: SpriteDef = {
  name: 'crow-fly-back',
  width: 16,
  height: 16,
  fps: 10,
  frames: crowFlyOut.frames.map(mirror),
};

/** Shop and companion slot icon: perched crow, 12�12 like the other icons. */
export const crowIcon: SpriteDef = {
  name: 'icon-crow',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '............',
      '......####..',
      '.....######.',
      '.....##R####',
      '.....#####..',
      '...#######..',
      '..###o####..',
      '.###o####...',
      '###.####....',
      '#....#.#....',
      '.....##.##..',
    ],
  ],
};

/** Peck impact, drawn at the beak tip on the hit frame. Ink only for now; the crow's own colour comes with the palette step. */
export const peckSpark: SpriteDef = {
  name: 'effect-peck-spark',
  width: 7,
  height: 7,
  fps: 10,
  frames: [
    ['#..#..#', '.#.#.#.', '..#.#..', '###.###', '..#.#..', '.#.#.#.', '#..#..#'],
    ['.......', '.#...#.', '...#...', '..#.#..', '...#...', '.#...#.', '.......'],
  ],
};

export type CompanionAnimation = 'idle' | 'flyOut' | 'peck' | 'flyBack';

/** Everything the renderer needs for one companion. `CompanionDef.sprites` is a key of `companionSprites`. */
export type CompanionSprites = {
  animations: Record<CompanionAnimation, SpriteDef>;
  icon: SpriteDef;
  /** Frame of `animations.peck` where damage lands. */
  hitFrame: number;
  /** Beak tip on the hit frame, in companion frame pixels. */
  hitPoint: Point;
  /** Impact effect, centred on `hitPoint` from the hit frame on. */
  hitEffect: SpriteDef;
};

export const companionSprites = {
  crow: {
    animations: { idle: crowIdle, flyOut: crowFlyOut, peck: crowPeck, flyBack: crowFlyBack },
    icon: crowIcon,
    hitFrame: 1,
    hitPoint: { x: 15, y: 10 },
    hitEffect: peckSpark,
  },
} satisfies Record<string, CompanionSprites>;
