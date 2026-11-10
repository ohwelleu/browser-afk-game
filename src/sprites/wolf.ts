import type { SpriteDef } from './types';

// Wolf companion (second companion after the crow). 24×16 on every frame,
// faces right (towards the mob) like the hero. Ink body (`#`) with a yellow
// eye (`Y`) and a light (`o`) muzzle and chest, so it reads in both themes
// and differs from the crow's red eye.
//
// Placement and timing are game logic (src/render/scene.ts): the wolf stands
// BEHIND the hero (to its left), drawn before the hero so the hero covers
// the end of its snout. Its feet are on the bottom row.
// - idle: stands, tail up / straight, blinks. 4 frames.
// - attack: crouch, leap, bite (hit frame), recover. The scene also slides
//   the sprite towards the mob and hops it, so the frames only show the pose.

const E = '........................';

/** Head and body, rows 0–11, tail up. Legs (rows 12–15) are added per frame. */
const BODY_TAIL_UP = [
  E,
  E,
  '................##.##...',
  '#...............#######.',
  '##..............###Y###.',
  '.##...##################',
  '..######################',
  '...##################oo.',
  '...###############oo#...',
  '...##############oooo...',
  '....#############ooo....',
  '....##############......',
];

/** Same body with the tail straight out behind: row 6 reaches the left edge. */
const BODY_TAIL_STRAIGHT = BODY_TAIL_UP.map((row, y) => {
  if (y === 3 || y === 4 || y === 5) return '......' + row.slice(6);
  if (y === 6) return '######' + row.slice(6);
  return row;
});

const LEGS_STAND = [
  '....##.##......##.##....',
  '....##.##......##.##....',
  '....##.##......##.##....',
  '...###.###....###.###...',
];

/** Leap: hind legs pushed back, front legs reaching forward. Feet off the ground. */
const LEGS_LEAP = ['...##..##........##.##..', '..##....##.......##..##.', E, E];

/** Crouch: one row shorter legs, paws wide. */
const LEGS_CROUCH = [
  '....##.##......##.##....',
  '...###.###....###.###...',
  '...###.###....###.###...',
];

/** Body on top of legs, bottom aligned: shorter legs (a crouch) lower the whole wolf. */
const frame = (body: string[], legs: string[]): string[] => {
  const rows = [...body, ...legs];
  return [...Array<string>(16 - rows.length).fill(E), ...rows];
};

const closeEye = (rows: string[]) => rows.map((r) => r.replace('Y', '#'));

/** Open jaws: the mouth gapes and a lower jaw drops below the snout. */
const openJaws = (rows: string[]) =>
  rows.map((r, y) => {
    if (y === 7) return '...#################oooo';
    if (y === 8) return '...##############oo####.';
    return r;
  });

const A = frame(BODY_TAIL_UP, LEGS_STAND);
const B = frame(BODY_TAIL_STRAIGHT, LEGS_STAND);

/** Standing: tail up, tail out, tail up, blink. 4 frames, 1.3 s loop. */
export const wolfIdle: SpriteDef = {
  name: 'wolf-idle',
  width: 24,
  height: 16,
  fps: 3,
  frames: [A, B, A, closeEye(A)],
};

const CROUCH = frame(BODY_TAIL_STRAIGHT, LEGS_CROUCH);
const LEAP = frame(BODY_TAIL_STRAIGHT, LEGS_LEAP);
const BITE = openJaws(LEAP);
const RECOVER = frame(BODY_TAIL_UP, LEGS_STAND);

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
      '............',
      '.##......##.',
      '.###....###.',
      '.####..####.',
      '.##########.',
      '.##Y####Y##.',
      '.##########.',
      '..###oo###..',
      '..##oooo##..',
      '...######...',
      '....####....',
      '............',
    ],
  ],
};
