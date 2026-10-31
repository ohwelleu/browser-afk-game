import type { WeaponDef } from './types';

// One sprite per pose per tier; `grip` is the pixel that sits in the hero's hand.
// Handles are fg, blades carry the tier colour so tiers read at a glance.

export const stick: WeaponDef = {
  name: 'Stick',
  tier: 0,
  poses: {
    fwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-stick-fwd',
        width: 11,
        height: 4,
        frames: [['.......GG..', '......#....', '###########', '...#.......']],
      },
    },
    back: {
      grip: { x: 9, y: 3 },
      sprite: {
        name: 'weapon-stick-back',
        width: 13,
        height: 6,
        frames: [
          [
            '...oo........',
            '..oGGo.......',
            '.oooo#oooooo.',
            'o###########o',
            '.ooooooo#ooo.',
            '........o....',
          ],
        ],
      },
    },
    up: {
      grip: { x: 2, y: 8 },
      sprite: {
        name: 'weapon-stick-up',
        width: 4,
        height: 11,
        frames: [
          ['..#.', '..#.', 'G.#.', 'G.#.', '.##.', '..#.', '..#.', '..##', '..#.', '..#.', '..#.'],
        ],
      },
    },
    upFwd: {
      grip: { x: 2, y: 8 },
      sprite: {
        name: 'weapon-stick-upFwd',
        width: 11,
        height: 11,
        frames: [
          [
            '......G...#',
            '.....G...#.',
            '........#..',
            '.....#.#...',
            '......#....',
            '.....#.....',
            '....#......',
            '...#.......',
            '..#.#......',
            '.#.........',
            '#..........',
          ],
        ],
      },
    },
    downFwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-stick-downFwd',
        width: 11,
        height: 11,
        frames: [
          [
            '#..........',
            '.#.........',
            '..#........',
            '...#.......',
            '..#.#......',
            '.....#.#.G.',
            '......#...G',
            '.......#...',
            '........#..',
            '.........#.',
            '..........#',
          ],
        ],
      },
    },
  },
};

export const woodenSword: WeaponDef = {
  name: 'Wooden sword',
  tier: 1,
  poses: {
    fwd: {
      grip: { x: 2, y: 1 },
      sprite: {
        name: 'weapon-wooden-sword-fwd',
        width: 12,
        height: 3,
        frames: [['...#OOOOOOO.', '####OOOOOOOO', '...#........']],
      },
    },
    back: {
      grip: { x: 10, y: 2 },
      sprite: {
        name: 'weapon-wooden-sword-back',
        width: 14,
        height: 5,
        frames: [
          [
            '..oooooooo....',
            '.oOOOOOOO#ooo.',
            'oOOOOOOOO####o',
            '.oooooooo#ooo.',
            '.........o....',
          ],
        ],
      },
    },
    up: {
      grip: { x: 1, y: 9 },
      sprite: {
        name: 'weapon-wooden-sword-up',
        width: 3,
        height: 12,
        frames: [
          ['.O.', 'OO.', 'OO.', 'OO.', 'OO.', 'OO.', 'OO.', 'OO.', '###', '.#.', '.#.', '.#.'],
        ],
      },
    },
    upFwd: {
      grip: { x: 2, y: 9 },
      sprite: {
        name: 'weapon-wooden-sword-upFwd',
        width: 12,
        height: 12,
        frames: [
          [
            '..........OO',
            '.........OO.',
            '........OO..',
            '.......OO...',
            '......OO....',
            '.....OO.....',
            '....OO......',
            '..#.O.......',
            '...#........',
            '..#.#.......',
            '.#..........',
            '#...........',
          ],
        ],
      },
    },
    downFwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-wooden-sword-downFwd',
        width: 12,
        height: 12,
        frames: [
          [
            '#...........',
            '.#..........',
            '..#.#.......',
            '...#O.......',
            '..#.OO......',
            '.....OO.....',
            '......OO....',
            '.......OO...',
            '........OO..',
            '.........OO.',
            '..........O.',
            '...........O',
          ],
        ],
      },
    },
  },
};

export const stoneSword: WeaponDef = {
  name: 'Stone sword',
  tier: 2,
  poses: {
    fwd: {
      grip: { x: 2, y: 1 },
      sprite: {
        name: 'weapon-stone-sword-fwd',
        width: 13,
        height: 3,
        frames: [['...#########.', '####o##o###o#', '...###.##.#..']],
      },
    },
    back: {
      grip: { x: 11, y: 2 },
      sprite: {
        name: 'weapon-stone-sword-back',
        width: 15,
        height: 5,
        frames: [
          [
            '..ooooooooo....',
            '.o#########ooo.',
            'o#o###o##o####o',
            '.oo#o##o###ooo.',
            '...o.oo.ooo....',
          ],
        ],
      },
    },
    up: {
      grip: { x: 1, y: 10 },
      sprite: {
        name: 'weapon-stone-sword-up',
        width: 3,
        height: 13,
        frames: [
          [
            '.#.',
            '#o.',
            '###',
            '##.',
            '###',
            '#o#',
            '##.',
            '###',
            '#o#',
            '###',
            '.#.',
            '.#.',
            '.#.',
          ],
        ],
      },
    },
    upFwd: {
      grip: { x: 2, y: 10 },
      sprite: {
        name: 'weapon-stone-sword-upFwd',
        width: 13,
        height: 13,
        frames: [
          [
            '...........##',
            '..........#o.',
            '.........##..',
            '........##.#.',
            '.......##....',
            '......#o.#...',
            '.....##.#....',
            '....##.......',
            '..#.o.#......',
            '...#.#.......',
            '..#.#........',
            '.#...........',
            '#............',
          ],
        ],
      },
    },
    downFwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-stone-sword-downFwd',
        width: 13,
        height: 13,
        frames: [
          [
            '#............',
            '.#...........',
            '..#.#........',
            '...##........',
            '..#.o#.......',
            '...#.##......',
            '....#.##.....',
            '.......o#....',
            '......#.##...',
            '.......#.##..',
            '..........##.',
            '.........#.o.',
            '............#',
          ],
        ],
      },
    },
  },
};

export const ironSword: WeaponDef = {
  name: 'Iron sword',
  tier: 3,
  poses: {
    fwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-iron-sword-fwd',
        width: 14,
        height: 5,
        frames: [
          [
            '...#..........',
            '...#BBBBBBBBB.',
            '##############',
            '...#..........',
            '...#..........',
          ],
        ],
      },
    },
    back: {
      grip: { x: 12, y: 3 },
      sprite: {
        name: 'weapon-iron-sword-back',
        width: 16,
        height: 7,
        frames: [
          [
            '...........o....',
            '..ooooooooo#o...',
            '.oBBBBBBBBB#ooo.',
            'o##############o',
            '.oooooooooo#ooo.',
            '..........o#o...',
            '...........o....',
          ],
        ],
      },
    },
    up: {
      grip: { x: 2, y: 11 },
      sprite: {
        name: 'weapon-iron-sword-up',
        width: 5,
        height: 14,
        frames: [
          [
            '..#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '.B#..',
            '#####',
            '..#..',
            '..#..',
            '..#..',
          ],
        ],
      },
    },
    upFwd: {
      grip: { x: 2, y: 11 },
      sprite: {
        name: 'weapon-iron-sword-upFwd',
        width: 14,
        height: 14,
        frames: [
          [
            '............B#',
            '...........B#.',
            '..........B#..',
            '.........B#...',
            '........B#....',
            '.......B#.....',
            '......B#......',
            '.....B#.......',
            '.#..B#........',
            '..#.#.........',
            '...#..........',
            '..#.#.........',
            '.#...#........',
            '#.............',
          ],
        ],
      },
    },
    downFwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-iron-sword-downFwd',
        width: 14,
        height: 14,
        frames: [
          [
            '#.............',
            '.#...#........',
            '..#.#.........',
            '...#B.........',
            '..#.#B........',
            '.#...#B.......',
            '......#B......',
            '.......#B.....',
            '........#B....',
            '.........#B...',
            '..........#B..',
            '...........#B.',
            '............#.',
            '.............#',
          ],
        ],
      },
    },
  },
};

export const goldSword: WeaponDef = {
  name: 'Gold sword',
  tier: 4,
  poses: {
    fwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-gold-sword-fwd',
        width: 15,
        height: 5,
        frames: [
          [
            '...Y...........',
            '...YYYYYYYYYYY.',
            'Y##ROOOOOOOOOOY',
            '...Y...........',
            '...Y...........',
          ],
        ],
      },
    },
    back: {
      grip: { x: 13, y: 3 },
      sprite: {
        name: 'weapon-gold-sword-back',
        width: 17,
        height: 7,
        frames: [
          [
            '............o....',
            '..ooooooooooYo...',
            '.oYYYYYYYYYYYooo.',
            'oYOOOOOOOOOOR##Yo',
            '.oooooooooooYooo.',
            '...........oYo...',
            '............o....',
          ],
        ],
      },
    },
    up: {
      grip: { x: 2, y: 12 },
      sprite: {
        name: 'weapon-gold-sword-up',
        width: 5,
        height: 15,
        frames: [
          [
            '..Y..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            '.YO..',
            'YYRYY',
            '..#..',
            '..#..',
            '..Y..',
          ],
        ],
      },
    },
    upFwd: {
      grip: { x: 2, y: 12 },
      sprite: {
        name: 'weapon-gold-sword-upFwd',
        width: 15,
        height: 15,
        frames: [
          [
            '.............YY',
            '............YO.',
            '...........YO..',
            '..........YO...',
            '.........YO....',
            '........YO.....',
            '.......YO......',
            '......YO.......',
            '.....YO........',
            '.Y..YO.........',
            '..Y.O..........',
            '...R...........',
            '..#.Y..........',
            '.#...Y.........',
            'Y..............',
          ],
        ],
      },
    },
    downFwd: {
      grip: { x: 2, y: 2 },
      sprite: {
        name: 'weapon-gold-sword-downFwd',
        width: 15,
        height: 15,
        frames: [
          [
            'Y..............',
            '.#...Y.........',
            '..#.Y..........',
            '...RY..........',
            '..Y.OY.........',
            '.Y...OY........',
            '......OY.......',
            '.......OY......',
            '........OY.....',
            '.........OY....',
            '..........OY...',
            '...........OY..',
            '............OY.',
            '.............O.',
            '..............Y',
          ],
        ],
      },
    },
  },
};

/** All weapons in shop order (index = tier). */
export const weapons: WeaponDef[] = [stick, woodenSword, stoneSword, ironSword, goldSword];
