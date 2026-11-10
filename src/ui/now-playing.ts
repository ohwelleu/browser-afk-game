import type { TrackCredit } from '../audio';
import { reducedCss } from '../motion';

export const NOW_PLAYING_STYLES = `
.now-playing {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 1;
  max-width: calc(100% - 240px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 8px;
  background: var(--_bg);
  border: 3px solid var(--_fg);
  pointer-events: none;
  transition: opacity 0.3s, visibility 0.3s;
}
.now-playing[hidden] { display: block; opacity: 0; visibility: hidden; }
${reducedCss('.now-playing')} { transition: none; }
`;

/** "Music: Gaming Time by Otrebil" → "♪ Gaming Time by Otrebil". */
export const nowPlayingText = (credit: TrackCredit): string =>
  `♪ ${credit.text.replace(/^Music:\s*/, '')}`;

/** The part of the note element the logic uses (so it can be tested without a DOM). */
export type NoteEl = Pick<HTMLElement, 'textContent'> & { hidden: boolean | string };

/**
 * A short "♪ title by author" note. `announce` is called when the music starts or the
 * track is switched (never on pause/resume): a track with a credit shows the note for
 * `ms`; one without hides any note still showing.
 */
export function createNowPlaying(el: NoteEl, ms = 4000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    el.hidden = true;
  };
  hide();
  return {
    announce(credit: TrackCredit | undefined): void {
      hide();
      if (!credit) return;
      el.textContent = nowPlayingText(credit);
      el.hidden = false;
      timer = setTimeout(hide, ms);
    },
    destroy: hide,
  };
}
