import type { SpriteDef } from './types';

// Wolf companion (second companion after the crow). 24×16 on every frame,
// faces right (towards the mob) like the hero. Same style as the crow: a
// solid ink silhouette with a yellow eye (`Y`; the crow's is red), plus the
// wolf's own marks: tall pointed ears, a long narrow snout, a lean body on
// long legs, a bushy tail hanging low, a light (`o`) ruff on the chest and
// neck and a lighter belly. The palette has no grey, so the lighter belly
// is a checkerboard of `#` and `o`.
//
// Placement and timing are game logic (src/render/scene.ts): the wolf stands
// BEHIND the hero (to its left), drawn before the hero so the hero covers
// the end of its snout. Its feet are on the bottom row.
// - idle: stands, tail swings, blinks. 4 frames.
// - attack: crouch, leap, bite (hit frame), recover. The scene also slides
//   the sprite towards the mob and hops it, so the frames only show the pose.

const E = '........................';

/** Standing, tail hanging low. The tail is part of rows 6–13. */
const STAND = [
  '................#..#....',
  '................##.##...',
  '...............#######..',
  '...............###Y####.',
  '.........###############',
  '...####################.',
  '.#############oooo#.....',
  '############ooooooo#....',
  '############oooooooo#...',
  '#o#####o#o#o#ooooooo#...',
  '#o#####.....#######.....',
  '#######.##...##..##.....',
  '##..###.##...##..##.....',
  '#..###..##...##..##.....',
  '...##...##...##..##.....',
  '...###..###..###.###....',
];

/** The tail tip swings in towards the legs. */
const STAND_SWING = STAND.map((row, y) => {
  if (y === 12) return '.##.###.##...##..##.....';
  if (y === 13) return '.#.###..##...##..##.....';
  return row;
});

/** Head, body and tail pushed straight back (rows 0–10), for the lunge. */
const BODY_OUT = [
  ...STAND.slice(0, 6),
  '##############oooo#.....',
  '############ooooooo#....',
  '############oooooooo#...',
  '...####o#o#o#ooooooo#...',
  '...#####.....#######....',
];

/** Leap: hind legs pushed back, front legs reaching forward. Feet off the ground. */
const LEGS_LEAP = [
  '..####..##...##..###....',
  '.###....##..##....###...',
  '.##...............###...',
  E,
  E,
];

/** Crouch: one row shorter legs, paws wide. */
const LEGS_CROUCH = [
  '...####.##...##..##.....',
  '..####..###..###.###....',
  '..###...###..###.###....',
  '..###..###..###..###....',
];

/** Body on top of legs, bottom aligned: shorter legs (a crouch) lower the whole wolf. */
const frame = (body: string[], legs: string[]): string[] => {
  const rows = [...body, ...legs];
  return [...Array<string>(16 - rows.length).fill(E), ...rows];
};

const closeEye = (rows: string[]) => rows.map((r) => r.replace('Y', '#'));

/** Open jaws: the upper jaw stays, a lower jaw drops and the mouth shows light. */
const openJaws = (rows: string[]) =>
  rows.map((r, y) => {
    if (y === 5) return '...#################ooo.';
    if (y === 6) return '##############oooo#####.';
    return r;
  });

const A = STAND;
const B = STAND_SWING;

/** Standing: tail hangs, tail swings in, tail hangs, blink. 4 frames, 1.3 s loop. */
export const wolfIdle: SpriteDef = {
  name: 'wolf-idle',
  width: 24,
  height: 16,
  fps: 3,
  frames: [A, B, A, closeEye(A)],
};

const CROUCH = frame(BODY_OUT, LEGS_CROUCH);
const LEAP = frame(BODY_OUT, LEGS_LEAP);
const BITE = openJaws(LEAP);
const RECOVER = A;

/**
 * Lunge and bite: crouch, leap, bite on the hit frame (index 2, jaws open),
 * recover. 0.4 s.
 */
export const wolfAttack: SpriteDef = {
  name: 'wolf-attack',
  width: 24,
  height: 16,
  fps: 10,
  frames: [CROUCH, LEAP, BITE, RECOVER],
};

/** Shop and companion list icon: the wolf's head, 12×12 like the other icons. */
export const wolfIcon: SpriteDef = {
  name: 'icon-wolf',
  width: 12,
  height: 12,
  frames: [
    [
      '.#........#.',
      '.##......##.',
      '.###....###.',
      '.##########.',
      '.##Y####Y##.',
      '.####oo####.',
      '..###oo###..',
      '..##oooo##..',
      '.###oooo###.',
      '.##.####.##.',
      '..#..##..#..',
      '............',
    ],
  ],
};
