import type { SpriteDef } from './types';

// Coin and shop/menu icons. Icons are single frames; draw them in fg with
// their colour accents, like every other sprite.

/** Coin, 8×8, spins in 4 frames (front, turning, edge, turning back). */
export const coinSpin: SpriteDef = {
  name: 'coin-spin',
  width: 8,
  height: 8,
  fps: 8,
  frames: [
    [
      '..OOOO..',
      '.OYYYOO.',
      'OYYOYYOO',
      'OYYOYYOO',
      'OYYOYYOO',
      'OYYOYYOO',
      '.OYYYOO.',
      '..OOOO..',
    ],
    [
      '...OOO..',
      '..OYYOO.',
      '..OYOYO.',
      '..OYOYO.',
      '..OYOYO.',
      '..OYOYO.',
      '..OYYOO.',
      '...OOO..',
    ],
    [
      '...OO...',
      '...YO...',
      '...YO...',
      '...YO...',
      '...YO...',
      '...YO...',
      '...YO...',
      '...OO...',
    ],
    [
      '..OOO...',
      '.OOYYO..',
      '.OYOYO..',
      '.OYOYO..',
      '.OYOYO..',
      '.OYOYO..',
      '.OOYYO..',
      '..OOO...',
    ],
  ],
};

/** Damage upgrade: impact burst. */
export const iconDamage: SpriteDef = {
  name: 'icon-damage',
  width: 12,
  height: 12,
  frames: [
    [
      '.....#......',
      '.#...##...#.',
      '..##.##.##..',
      '..###RR###..',
      '...#RRRR#...',
      '####RRRR####',
      '.###RRRR###.',
      '...#RRRR#...',
      '..###RR###..',
      '..##.##.##..',
      '.#...##...#.',
      '......#.....',
    ],
  ],
};

/** Attack speed upgrade: lightning bolt. */
export const iconSpeed: SpriteDef = {
  name: 'icon-speed',
  width: 12,
  height: 12,
  frames: [
    [
      '......#####.',
      '.....#BBB#..',
      '....#BBB#...',
      '...#BBB#....',
      '..#BBBB####.',
      '.#BBBBBBB#..',
      '.####BBB#...',
      '....#BB#....',
      '...#BB#.....',
      '...#B#......',
      '..#B#.......',
      '..##........',
    ],
  ],
};

/** Buy next weapon: sword with a steel edge. */
export const iconWeapon: SpriteDef = {
  name: 'icon-weapon',
  width: 12,
  height: 12,
  frames: [
    [
      '..........##',
      '.........#B#',
      '........#B#.',
      '.......#B#..',
      '......#B#...',
      '.....#B#....',
      '..#.#B#.....',
      '...#B#......',
      '...##.......',
      '..#..#......',
      '.#..........',
      '#...........',
    ],
  ],
};

/** Auto-advance: fast-forward to the next stage. */
export const iconAutoAdvance: SpriteDef = {
  name: 'icon-auto-advance',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '............',
      '#....#....##',
      '##...##...##',
      '###..###..##',
      '####.####.##',
      '####.####.##',
      '###..###..##',
      '##...##...##',
      '#....#....##',
      '............',
      '............',
    ],
  ],
};

/** Music volume: two beamed notes. */
export const iconMusic: SpriteDef = {
  name: 'icon-music',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '....#######.',
      '....#######.',
      '....#.....#.',
      '....#.....#.',
      '....#.....#.',
      '....#.....#.',
      '..###...###.',
      '.####..####.',
      '.####..####.',
      '..##....##..',
      '............',
    ],
  ],
};

/** Sound effects volume: speaker with waves. */
export const iconSfx: SpriteDef = {
  name: 'icon-sfx',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '.....#......',
      '....##...#..',
      '...###.#..#.',
      '######..#..#',
      '######..#..#',
      '######..#..#',
      '######..#..#',
      '...###.#..#.',
      '....##...#..',
      '.....#......',
      '............',
    ],
  ],
};

/** Music muted. */
export const iconMusicOff: SpriteDef = {
  name: 'icon-music-off',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '....######Ro',
      '....#####Ro.',
      '....#...Ro#.',
      '....#..Ro.#.',
      '....#.Ro..#.',
      '....#Ro...#.',
      '..##Ro..###.',
      '.##Ro..####.',
      '.#Ro#..####.',
      '.Ro#....##..',
      '............',
    ],
  ],
};

/** Sound effects muted. */
export const iconSfxOff: SpriteDef = {
  name: 'icon-sfx-off',
  width: 12,
  height: 12,
  frames: [
    [
      '............',
      '.....#....Ro',
      '....##...Ro.',
      '...###.#Ro#.',
      '######.Ro..#',
      '######Ro#..#',
      '#####Ro.#..#',
      '####Ro..#..#',
      '...Ro#.#..#.',
      '..Ro##...#..',
      '.Ro..#......',
      '............',
    ],
  ],
};

export const icons = {
  damage: iconDamage,
  speed: iconSpeed,
  weapon: iconWeapon,
  autoAdvance: iconAutoAdvance,
  music: iconMusic,
  sfx: iconSfx,
  musicOff: iconMusicOff,
  sfxOff: iconSfxOff,
} satisfies Record<string, SpriteDef>;
