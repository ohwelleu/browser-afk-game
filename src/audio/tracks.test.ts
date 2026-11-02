import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACK, TRACK_IDS } from '.';

describe('music tracks', () => {
  it('defaults new players to synthwave', () => {
    expect(DEFAULT_TRACK).toBe('synthwave');
  });

  it('starts the HUD switch cycle at the default track', () => {
    expect(TRACK_IDS[0]).toBe(DEFAULT_TRACK);
    expect(TRACK_IDS).toEqual(['synthwave', 'medieval']);
  });
});
