import type { Audio } from "./audio/types";

/** No-op audio until the music thread's `createAudio()` lands in `src/audio/`. */
export function createAudio(): Audio {
  return {
    start: () => Promise.resolve(),
    pause() {},
    resume() {},
    setMusicVolume() {},
    setSfxVolume() {},
    setMuted() {},
    play() {},
  };
}
