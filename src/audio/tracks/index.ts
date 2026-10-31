import type { Track } from '../types';
import { medieval } from './medieval';
import { synthwave } from './synthwave';

// To add a track, register it here. A recorded loop is one line, e.g.:
//   import { fileTrack } from '../track';
//   fileTrack('tavern', new URL('./tavern.ogg', import.meta.url).href, { gain: 0.8 })
export const TRACKS: Record<string, Track> = Object.fromEntries(
  [medieval, synthwave].map((t) => [t.id, t]),
);

export const DEFAULT_TRACK = 'medieval';
