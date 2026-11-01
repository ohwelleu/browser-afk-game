import type { SfxName } from './types';
import { zzfxBuild, type ZzfxParams } from './vendor/zzfx';

// ZzFX sounds, same parameter order as the designer (https://killedbyapixel.github.io/ZzFX/):
// volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
// pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay,
// tremolo, filter
export const SFX: Record<SfxName, ZzfxParams> = {
  // short rising noisy whoosh
  swing: [0.35, 0.1, 320, 0.01, 0.02, 0.06, 0, 1, 14, , , , , 1.2],
  // dull tan-wave thud, sliding down
  hit: [0.45, 0.08, 200, 0, 0.01, 0.08, 3, 1.5, -15, , , , , 0.4],
  // crunchy falling squelch
  mobDeath: [0.6, 0.05, 420, 0, 0.04, 0.25, 1, 1, -3, , , , , 0.3, , 0.05],
  // classic two-tone ding (B5 → E6)
  coin: [0.45, 0.04, 988, 0, 0.05, 0.2, 1, 1, , , 331, 0.05],
  // quick C–G–C–E ka-ching, using repeat + pitch jump as a staircase
  purchase: [0.55, 0, 523, 0, 0.08, 0.15, 1, 1, , , 262, 0.06, 0.06, , , , 0.05],
  // long sad falling saw, low-passed
  heroDeath: [0.4, 0, 330, 0.02, 0.3, 0.6, 2, 1, -0.6, , , , , 0.1, , 0.02, , 1, , , -1200],
  // low throbbing swell with an echo
  bossAppear: [0.37, 0, 60, 0.3, 0.5, 0.7, 2, 1, , , , , 0.08, 0.2, , , 0.15, 1, , 0.5, -800],
  // rising G–C–E–G arpeggio with an echo
  stageClear: [0.6, 0, 392, 0, 0.2, 0.2, 1, 1, , , 131, 0.1, 0.1, , , , 0.1],
  // soft high blip with a short echo: an item dropped
  itemDrop: [0.4, 0, 1319, 0, 0.03, 0.12, 0, 1, , , 330, 0.04, , , , , 0.06],
  // S item: bright shimmering sparkle, rising, with tremolo and echo
  itemDropS: [0.5, 0, 1568, 0.01, 0.25, 0.4, 0, 1, 2, , 523, 0.06, 0.08, , , , 0.1, 0.9, , 0.3],
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

/** Repeats of the same sound closer than this are dropped, so fast combat doesn't stack up. */
const MIN_GAP = 0.035;

/**
 * Pre-renders every sound once, then plays buffers into `out`. Like upstream
 * `ZZFXSound`, the frequency randomness becomes a random playback rate.
 */
export function createSfx(ctx: BaseAudioContext, out: AudioNode) {
  const sounds = new Map<SfxName, { buffer: AudioBuffer; randomness: number }>();
  for (const name of SFX_NAMES) {
    const params = [...SFX[name]];
    const randomness = params[1] ?? 0.05;
    params[1] = 0;
    const samples = zzfxBuild(ctx.sampleRate, params);
    const buffer = ctx.createBuffer(1, Math.max(1, samples.length), ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    sounds.set(name, { buffer, randomness });
  }
  const lastPlayed = new Map<SfxName, number>();

  return {
    play(name: SfxName, time = ctx.currentTime): void {
      const sound = sounds.get(name);
      if (!sound) return;
      if (time - (lastPlayed.get(name) ?? -1) < MIN_GAP) return;
      lastPlayed.set(name, time);
      const src = ctx.createBufferSource();
      src.buffer = sound.buffer;
      src.playbackRate.value = 1 + sound.randomness * (Math.random() * 2 - 1);
      src.connect(out);
      src.start(time);
    },
  };
}
