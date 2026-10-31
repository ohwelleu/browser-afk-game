import type { Track, TrackHandle } from './types';

/** Seconds for a track to fade in/out when switching. */
export const FADE = 0.4;

/** Fade a track's output to 0, then disconnect it once tails have rung out. Returns the end time. */
export function fadeOut(ctx: BaseAudioContext, gain: GainNode, tail = 3): number {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE);
  setTimeout(() => gain.disconnect(), (FADE + tail) * 1000);
  return now + FADE;
}

const buffers = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>();

function load(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let byUrl = buffers.get(ctx);
  if (!byUrl) buffers.set(ctx, (byUrl = new Map()));
  let buffer = byUrl.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    byUrl.set(url, buffer);
  }
  return buffer;
}

export interface FileTrackOptions {
  /** Output level, 0..1. */
  gain?: number;
  /** Loop points in seconds, for files with an intro. Defaults to the whole file. */
  loopStart?: number;
  loopEnd?: number;
}

/** A looping OGG/MP3, decoded into a buffer so the loop point is sample-exact. */
export function fileTrack(id: string, url: string, options: FileTrackOptions = {}): Track {
  const { gain: level = 1, loopStart = 0, loopEnd = 0 } = options;
  return {
    id,
    kind: 'file',
    play(ctx, out): TrackHandle {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(out);
      let stopped = false;
      let source: AudioBufferSourceNode | undefined;
      load(ctx, url)
        .then((buffer) => {
          if (stopped) return;
          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = loopStart;
          source.loopEnd = loopEnd;
          source.connect(gain);
          const t = ctx.currentTime;
          source.start(t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(level, t + FADE);
        })
        .catch((e) => console.warn(`[audio] track "${id}" failed to load`, e));
      return {
        stop() {
          stopped = true;
          const end = fadeOut(ctx, gain, 0.1);
          source?.stop(end);
        },
      };
    },
  };
}
