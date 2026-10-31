import type { AudioSettings } from '../save';
import { createShow, html } from './dom';
import { dialogHtml } from './modal';

export const SOUND_STYLES = `
.slider { display: grid; gap: 4px; margin: 10px 0 2px; }
input[type='range'] { width: 100%; accent-color: var(--_fg); }
.popover .panel { font-size: 1.1em; }
@container afk-box (max-width: 767px) {
  input[type='range'] { height: 44px; }
}
`;

export type SoundDeps = {
  toggleMute(): void;
  /** Live volume change, 0..1. */
  setVolume(key: 'musicVolume' | 'sfxVolume', value: number): void;
  /** Slider released: persist. */
  commit(): void;
};

export type SoundPanel = { el: HTMLElement; refresh(settings: AudioSettings): void };

/** The sound popover: mute plus music / effects volume. */
export function createSoundPanel(deps: SoundDeps, initial: AudioSettings): SoundPanel {
  const el = html(
    dialogHtml({
      kind: 'popover',
      id: 'afk-sound',
      title: 'Sound',
      closeLabel: 'Close sound settings',
      body: `
        <div class="row"><span>All sound</span><button type="button" class="toggle" data-act="mute"></button></div>
        <label class="slider">Music volume <input type="range" min="0" max="100" step="1" data-vol="musicVolume" /></label>
        <label class="slider">Effects volume <input type="range" min="0" max="100" step="1" data-vol="sfxVolume" /></label>`,
    }),
  );
  const show = createShow();
  const muteToggle = el.querySelector<HTMLButtonElement>('[data-act="mute"]')!;
  muteToggle.addEventListener('click', () => deps.toggleMute());

  for (const key of ['musicVolume', 'sfxVolume'] as const) {
    const slider = el.querySelector<HTMLInputElement>(`[data-vol="${key}"]`)!;
    slider.value = String(Math.round(initial[key] * 100));
    slider.addEventListener('input', () => {
      deps.setVolume(key, Math.min(1, Math.max(0, Number(slider.value) / 100 || 0)));
    });
    slider.addEventListener('change', () => deps.commit());
  }

  function refresh(settings: AudioSettings): void {
    muteToggle.setAttribute('aria-pressed', String(!settings.muted));
    show(muteToggle, settings.muted ? 'OFF' : 'ON');
  }

  return { el, refresh };
}
