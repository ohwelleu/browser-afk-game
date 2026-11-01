import type { SpriteDef } from './types';

/**
 * PLACEHOLDER crow until the real sprites land (branch `art/crow`): one
 * idle loop (wings down / up) used for every pose, and as the shop icon.
 * Faces right, towards the mob.
 */
export const crowPlaceholder: SpriteDef = {
  name: 'crow-placeholder',
  width: 12,
  height: 9,
  fps: 4,
  frames: [
    [
      '............',
      '........###.',
      '.......#o##O',
      '..#.....###.',
      '.######.##..',
      '..#########.',
      '...#######..',
      '......#.#...',
      '......#.#...',
    ],
    [
      '..##........',
      '...##...###.',
      '....##.#o##O',
      '.....##.###.',
      '..#####.##..',
      '..#########.',
      '...#######..',
      '......#.#...',
      '......#.#...',
    ],
  ],
};
