/** Audio interface shared with the music thread. */
export type SfxName =
  "swing" | "hit" | "mobDeath" | "coin" | "purchase" | "heroDeath" | "bossAppear" | "stageClear";

export type Audio = {
  /** Called from the Start button click, so it may unlock the AudioContext. */
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  setMusicVolume(v: number): void;
  setSfxVolume(v: number): void;
  setMuted(muted: boolean): void;
  play(sfx: SfxName): void;
};
