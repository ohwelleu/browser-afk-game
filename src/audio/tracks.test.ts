import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACK, TRACK_IDS, trackCredit } from '.';

describe('music tracks', () => {
  it('defaults new players to Gaming Time', () => {
    expect(DEFAULT_TRACK).toBe('gaming-time');
  });

  it('starts the HUD switch cycle at the default track', () => {
    expect(TRACK_IDS[0]).toBe(DEFAULT_TRACK);
    expect(TRACK_IDS).toEqual(['gaming-time', 'synthwave', 'medieval']);
  });

  it('credits Otrebil for Gaming Time, and only that track', () => {
    expect(trackCredit('gaming-time')).toEqual({
      text: 'Music: Gaming Time by Otrebil',
      url: 'https://www.youtube.com/watch?v=qx7avPhISBo',
    });
    expect(trackCredit('synthwave')).toBeUndefined();
    expect(trackCredit('medieval')).toBeUndefined();
    expect(trackCredit('')).toBeUndefined();
    expect(trackCredit('gone')).toBeUndefined();
  });
});
