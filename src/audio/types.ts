export type SfxName =
  | 'swing'
  | 'hit'
  | 'mobDeath'
  | 'coin'
  | 'purchase'
  | 'heroDeath'
  | 'bossAppear'
  | 'stageClear'
  | 'itemDrop'
  | 'itemDropS';

export interface GameAudio {
  /** Call from the Start button click: creates/unlocks the AudioContext and starts the music. */
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  /** 0..1, mapped on a squared curve so the slider feels even. */
  setMusicVolume(v: number): void;
  /** 0..1, mapped on a squared curve so the slider feels even. */
  setSfxVolume(v: number): void;
  setMuted(m: boolean): void;
  play(sfx: SfxName): void;
  /** Switch music. Unknown ids warn; `''` stops the music. Safe to call before `start()`. */
  setTrack(id: string): void;
}

/** A playing track. `stop()` fades it out and frees its nodes. */
export interface TrackHandle {
  stop(): void;
}

/** Credit shown in the sound settings while the track is selected. */
export interface TrackCredit {
  text: string;
  url: string;
}

/** A music source. Register new ones in `tracks/index.ts`; game code only ever sees the id. */
export interface Track {
  readonly id: string;
  readonly kind: 'synth' | 'file';
  readonly credit?: TrackCredit;
  play(ctx: BaseAudioContext, out: AudioNode): TrackHandle;
}
