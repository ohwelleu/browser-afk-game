import type { Track } from '../types';
import { medieval } from './medieval';
import { synthwave } from './synthwave';

// To add a track, register it here; order = HUD music switch order. A recorded loop is one line, e.g.:
//   import { fileTrack } from '../track';
//   fileTrack('tavern', new URL('./tavern.ogg', import.meta.url).href, { gain: 0.8 })
export const TRACKS: Record<string, Track> = Object.fromEntries(
  [synthwave, medieval].map((t) => [t.id, t]),
);

/** Played for new players (no saved track). Registration order above is the HUD switch order. */
export const DEFAULT_TRACK = 'synthwave';
