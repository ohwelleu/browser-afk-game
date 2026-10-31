import { FADE, fadeOut } from './track';
import type { Track, TrackHandle } from './types';

export interface SongVoices {
  /** Schedule everything that starts on `step` (0 … steps-1) at `time`. */
  step(step: number, time: number): void;
  /** Stop persistent voices (drones etc.) at `time`. */
  stop?(time: number): void;
}

export interface SynthSong {
  bpm: number;
  stepsPerBeat: number;
  /** Loop length in steps. The step counter wraps here, so the loop is seamless. */
  steps: number;
  /** Build effects and persistent voices into `out`; return the step callback. */
  setup(ctx: BaseAudioContext, out: AudioNode, stepTime: number): SongVoices;
}

export const stepTime = (song: SynthSong): number => 60 / song.bpm / song.stepsPerBeat;

/** Loop length in seconds. */
export const loopSeconds = (song: SynthSong): number => song.steps * stepTime(song);

const TICK_MS = 50;

export type SynthTrack = Track & { readonly song: SynthSong };

/** Lookahead step sequencer: a timer schedules notes slightly ahead on the audio clock. */
export function synthTrack(id: string, song: SynthSong): SynthTrack {
  return {
    id,
    kind: 'synth',
    song,
    play(ctx, out): TrackHandle {
      const gain = ctx.createGain();
      gain.connect(out);
      const dt = stepTime(song);
      const t0 = ctx.currentTime + 0.05;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, t0 + FADE);
      const voices = song.setup(ctx, gain, dt);
      let step = 0;
      let next = t0;

      const tick = () => {
        // Hidden tabs throttle timers to ~1 s, so look further ahead there.
        const ahead = typeof document !== 'undefined' && document.hidden ? 1.5 : 0.25;
        const now = ctx.currentTime;
        if (next < now - 0.1) {
          // Fell behind (stalled main thread): skip ahead instead of a burst of late notes.
          const skip = Math.ceil((now - next) / dt);
          step += skip;
          next += skip * dt;
        }
        while (next < now + ahead) {
          voices.step(step % song.steps, next);
          step++;
          next += dt;
        }
      };
      tick();
      const timer = setInterval(tick, TICK_MS);

      return {
        stop() {
          clearInterval(timer);
          voices.stop?.(fadeOut(ctx, gain));
        },
      };
    },
  };
}
