import type { SfxName } from './audio/types';

/** Higher plays first; when the voice cap is hit, the lowest are dropped. */
export const SFX_PRIORITY: Record<SfxName, number> = {
  heroDeath: 10,
  bossAppear: 9,
  stageClear: 8,
  mobDeath: 7,
  purchase: 6,
  hit: 5,
  swing: 3,
  coin: 1,
};

/**
 * Decides which requested sounds actually play: highest priority first, no
 * repeat of the same sound within `cooldown` seconds, at most `maxVoices`
 * sounds overlapping (each counted for `voiceLength` seconds).
 */
export class SfxMixer {
  private lastPlayed = new Map<SfxName, number>();
  private voiceEnds: number[] = [];

  constructor(
    private readonly cooldown = 0.05,
    private readonly maxVoices = 6,
    private readonly voiceLength = 0.3,
  ) {}

  mix(requests: Iterable<SfxName>, now: number): SfxName[] {
    const unique = [...new Set(requests)].sort((a, b) => SFX_PRIORITY[b] - SFX_PRIORITY[a]);
    this.voiceEnds = this.voiceEnds.filter((end) => end > now);
    const out: SfxName[] = [];
    for (const name of unique) {
      const last = this.lastPlayed.get(name);
      if (last !== undefined && now - last < this.cooldown) continue;
      if (this.voiceEnds.length >= this.maxVoices) break;
      this.lastPlayed.set(name, now);
      this.voiceEnds.push(now + this.voiceLength);
      out.push(name);
    }
    return out;
  }
}
