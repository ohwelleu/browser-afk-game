import { createSfx, SFX_NAMES } from './sfx';
import { DEFAULT_TRACK, TRACKS } from './tracks';
import type { GameAudio, SfxName, TrackHandle } from './types';

export type { GameAudio, SfxName, Track, TrackHandle } from './types';
export { SFX_NAMES };
export const TRACK_IDS = Object.keys(TRACKS);

/** Defaults for a fresh save. Low on purpose: this plays on a blog. */
export const AUDIO_DEFAULTS = { musicVolume: 0.5, sfxVolume: 0.6, muted: false } as const;

/** Slider position → gain. Squared so the low end of the slider is usable. */
const curve = (v: number) => Math.min(1, Math.max(0, v)) ** 2;
/** Base level of the SFX bus relative to music (ZzFX's own default master is 0.3). */
const SFX_LEVEL = 0.5;
const SMOOTH = 0.05;

export function createAudio(): GameAudio {
  let ctx: AudioContext | undefined;
  let musicBus: GainNode | undefined;
  let sfxBus: GainNode | undefined;
  let master: GainNode | undefined;
  let sfx: ReturnType<typeof createSfx> | undefined;
  let starting: Promise<void> | undefined;
  let started = false;
  let current: TrackHandle | undefined;

  let musicVolume: number = AUDIO_DEFAULTS.musicVolume;
  let sfxVolume: number = AUDIO_DEFAULTS.sfxVolume;
  let muted: boolean = AUDIO_DEFAULTS.muted;
  let paused = false;
  let trackId = DEFAULT_TRACK;

  const set = (param: AudioParam | undefined, v: number) => {
    if (ctx && param) param.setTargetAtTime(v, ctx.currentTime, SMOOTH);
  };

  function playTrack(): void {
    current?.stop();
    current = undefined;
    if (!ctx || !musicBus || !trackId) return;
    const track = TRACKS[trackId];
    if (!track) {
      console.warn(`[audio] unknown track "${trackId}", known: ${Object.keys(TRACKS).join(', ')}`);
      return;
    }
    current = track.play(ctx, musicBus);
  }

  function build(): AudioContext {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new Ctor();

    // music ─┐
    //        ├─ master (mute) ─ limiter ─ destination
    // sfx ───┘
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(c.destination);

    master = c.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(limiter);
    musicBus = c.createGain();
    musicBus.gain.value = curve(musicVolume);
    musicBus.connect(master);
    sfxBus = c.createGain();
    sfxBus.gain.value = curve(sfxVolume) * SFX_LEVEL;
    sfxBus.connect(master);
    sfx = createSfx(c, sfxBus);
    return c;
  }

  return {
    start() {
      paused = false;
      if (!starting) {
        // The context is created synchronously, inside the click that called start().
        ctx = build();
        const c = ctx;
        starting = c.resume().then(() => {
          started = true;
          if (paused) void c.suspend();
          playTrack();
        });
      } else {
        void ctx?.resume();
      }
      return starting;
    },

    pause() {
      paused = true;
      void ctx?.suspend();
    },

    resume() {
      paused = false;
      void ctx?.resume();
    },

    setMusicVolume(v) {
      musicVolume = v;
      set(musicBus?.gain, curve(v));
    },

    setSfxVolume(v) {
      sfxVolume = v;
      set(sfxBus?.gain, curve(v) * SFX_LEVEL);
    },

    setMuted(m) {
      muted = m;
      set(master?.gain, m ? 0 : 1);
    },

    play(name: SfxName) {
      if (!ctx || !sfx || paused || muted || ctx.state !== 'running') return;
      sfx.play(name);
    },

    setTrack(id) {
      if (id === trackId && (current || !ctx)) return;
      trackId = id;
      // Before start() resolves, start() itself picks the track up. While paused, the
      // new track is scheduled on the frozen clock and plays on resume().
      if (started) playTrack();
    },
  };
}
