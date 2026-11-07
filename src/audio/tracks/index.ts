import type { Track } from '../types';
import { fileTrack } from '../track';
// ?inline: a data: URL, so the one-file embed carries it. It is only fetched and decoded
// when the track is first played (after the Start click), never while the page loads.
import gamingTimeUrl from './gaming-time.ogg?inline';
import { medieval } from './medieval';
import { synthwave } from './synthwave';

// Gaming Time by Otrebil, used with the author's written permission. The whole song (2:56, 120 BPM):
// the intro (0:00-0:16) plays once, then the track loops from the drop (bar 8, 16 s) to the end of the
// finale (bar 88, 176 s). The last 0.25 s of the file is cross-faded into the bar before the drop,
// so the jump back has no gap or click. Both loop points are whole samples at 44.1 and 48 kHz.
const gamingTime = fileTrack('gaming-time', gamingTimeUrl, {
  gain: 0.41,
  loopStart: 16,
  loopEnd: 176,
  credit: {
    text: 'Music: Gaming Time by Otrebil',
    url: 'https://www.youtube.com/watch?v=qx7avPhISBo',
  },
});

// To add a track, register it here; order = HUD music switch order. A recorded loop is one line, e.g.:
//   import tavernUrl from './tavern.ogg?inline';
//   fileTrack('tavern', tavernUrl, { gain: 0.8 })
export const TRACKS: Record<string, Track> = Object.fromEntries(
  [gamingTime, synthwave, medieval].map((t) => [t.id, t]),
);

/** Played for new players (no saved track). Registration order above is the HUD switch order. */
export const DEFAULT_TRACK = 'gaming-time';
