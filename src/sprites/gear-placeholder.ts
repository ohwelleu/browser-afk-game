import type { SpriteDef } from './types';

// PLACEHOLDERS for the ring and pendant icons. The real art comes from the
// `art/items` branch; when it lands, point `gearIcons` at it and delete this file.

export const ringPlaceholder: SpriteDef = {
  name: 'ring-placeholder',
  width: 8,
  height: 8,
  frames: [
    [
      '...BB...',
      '..BooB..',
      '..####..',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '..####..',
      '........',
    ],
  ],
};

export const pendantPlaceholder: SpriteDef = {
  name: 'pendant-placeholder',
  width: 8,
  height: 8,
  frames: [
    [
      '.#....#.',
      '.#....#.',
      '..#..#..',
      '...##...',
      '..#PP#..',
      '.#PooP#.',
      '..#PP#..',
      '...##...',
    ],
  ],
};

export const gearIcons = { ring: ringPlaceholder, pendant: pendantPlaceholder } as const;
