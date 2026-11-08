import { RAINBOW_STOPS, RAINBOW_STYLES, rainbowColor, rainbowStep } from './rainbow';

/** Debug panel section "Rainbow": the colour in every form it comes in. Not used by the game. */
export const RAINBOW_DEMO_STYLES = `${RAINBOW_STYLES}
.dbg-rainbow summary { padding: 0; font-weight: normal; }
.dbg-rainbow[open] summary { border: 0; margin-bottom: 6px; }
.dbg-rainbow-list { display: grid; gap: 8px; }
.dbg-rainbow-list p { margin: 0; }
.dbg-rainbow-box { padding: 6px 8px; margin: 3px; }
.dbg-rainbow-dmg {
  font-size: var(--afk-fs, 16px);
  text-shadow: 1px 0 var(--_bg), -1px 0 var(--_bg), 0 1px var(--_bg), 0 -1px var(--_bg);
}
.dbg-rainbow canvas { position: static; width: 168px; height: 36px; border: 3px solid var(--_fg); }
.dbg-rainbow label { display: flex; gap: 8px; align-items: center; }
.dbg-rainbow input[type='range'] { flex: 1; accent-color: var(--_fg); }
`;

export const RAINBOW_DEMO_HTML = `
<details class="dbg-compare dbg-rainbow">
  <summary>Rainbow (S-tier colour)</summary>
  <div class="dbg-rainbow-list">
    <label>Cycle <input type="range" name="rainbow-speed" min="1" max="12" step="0.5" value="6" aria-label="Rainbow cycle length in seconds" /><span class="dbg-rainbow-secs">6s</span></label>
    <p class="rainbow">CSS text: S-tier loot</p>
    <p class="dbg-rainbow-box rainbow-frame">CSS frame and glow, like an S-tier item</p>
    <p class="rainbow dbg-rainbow-dmg">-12.3K</p>
    <p class="dbg-rainbow-js">JS smooth: <b></b></p>
    <canvas width="42" height="9" aria-label="Stepped rainbow swatch"></canvas>
    <p class="dbg-stats dbg-rainbow-note"></p>
  </div>
</details>`;

/**
 * Wires the section in `root`: the speed slider and the JS-drawn parts. The
 * frame loop only runs while the section is open, and not at all with
 * `prefers-reduced-motion` (then the JS parts are drawn once, still).
 * Returns a function that stops everything.
 */
export function mountRainbowDemo(root: HTMLElement): () => void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const details = q<HTMLDetailsElement>('.dbg-rainbow');
  const slider = q<HTMLInputElement>('[name="rainbow-speed"]');
  const secs = q<HTMLSpanElement>('.dbg-rainbow-secs');
  const js = q<HTMLElement>('.dbg-rainbow-js b');
  const canvas = q<HTMLCanvasElement>('.dbg-rainbow canvas');
  const note = q<HTMLElement>('.dbg-rainbow-note');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)');

  const periodMs = () => Number(slider.value) * 1000;
  let raf = 0;
  let lastStep = '';

  /** Canvas at 42x9 px shown 4x: a big chip with the current colour, then all seven. */
  function draw(t: number, force = false): void {
    const p = periodMs();
    const step = rainbowStep(t, p);
    js.textContent = rainbowColor(t, p);
    js.style.color = rainbowColor(t, p);
    if (!ctx || (!force && step === lastStep)) return;
    lastStep = step;
    const fg = getComputedStyle(canvas).getPropertyValue('--_fg').trim() || 'currentColor';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = step;
    ctx.fillRect(0, 0, 9, 9);
    RAINBOW_STOPS.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(11 + i * 4, 3, 3, 3);
      if (c === step) {
        ctx.fillStyle = fg;
        ctx.fillRect(11 + i * 4, 7, 3, 1);
      }
    });
  }

  function frame(now: number): void {
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function sync(): void {
    stop();
    const still = reduced?.matches ?? false;
    note.textContent = still ? 'Reduced motion: animation is off.' : '';
    if (details.open) {
      if (still) draw(0, true);
      else raf = requestAnimationFrame(frame);
    }
  }

  slider.addEventListener('input', () => {
    secs.textContent = `${slider.value}s`;
    details.style.setProperty('--afk-rainbow-period', `${slider.value}s`);
    lastStep = '';
    if (!raf) draw(0, true);
  });
  details.addEventListener('toggle', sync);
  reduced?.addEventListener?.('change', sync);
  sync();

  return () => {
    stop();
    details.removeEventListener('toggle', sync);
    reduced?.removeEventListener?.('change', sync);
  };
}
