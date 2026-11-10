import { RAINBOW_HUES, RAINBOW_STYLES, rainbowColor, rainbowHsl, rainbowStep } from './rainbow';

const SWATCH_HUES = RAINBOW_HUES.slice(0, -1);

/** Debug panel section "Rainbow": the flowing gradient in every form. Not used by the game. */
export const RAINBOW_DEMO_STYLES = `${RAINBOW_STYLES}
.dbg-rainbow summary { padding: 0; font-weight: normal; }
.dbg-rainbow[open] summary { border: 0; margin-bottom: 6px; }
.dbg-rainbow-list { display: grid; gap: 8px; }
.dbg-rainbow-list p { margin: 0; }
.dbg-rainbow-row { display: flex; gap: 12px; align-items: center; padding: 4px; }
.dbg-rainbow-slot { flex: none; display: grid; place-items: center; width: 40px; height: 40px; box-sizing: border-box; }
.dbg-rainbow-item { width: 20px; height: 20px; background: var(--_fg); clip-path: polygon(50% 0, 100% 40%, 80% 100%, 20% 100%, 0 40%); }
.dbg-rainbow-big { font-size: var(--afk-fs, 16px); font-weight: bold; }
.dbg-rainbow-bar { height: 14px; border: 3px solid var(--_fg); }
.dbg-rainbow-bar > .rainbow-fill { display: block; height: 100%; width: 70%; }
.dbg-rainbow canvas { position: static; width: 192px; height: 36px; border: 3px solid var(--_fg); image-rendering: pixelated; }
.dbg-rainbow label { display: flex; gap: 8px; align-items: center; }
.dbg-rainbow input[type='range'] { flex: 1; accent-color: var(--_fg); }
.dbg-rainbow input[type='checkbox'] { accent-color: var(--_fg); }
/* Demo only: keep the flow even when the system asks for reduced motion (the game's rules in
   rainbow.ts stay still). Higher specificity than the media query there. Removed by "Respect reduced motion". */
.dbg-rainbow.dbg-rainbow-motion .rainbow,
.dbg-rainbow.dbg-rainbow-motion .rainbow-fill,
.dbg-rainbow.dbg-rainbow-motion .rainbow-frame::before,
.dbg-rainbow.dbg-rainbow-motion .rainbow-glow::after {
  animation: afk-rainbow-flow var(--afk-rainbow-period, 4s) ease-in-out infinite;
  background-position: 0% 0%;
}
`;

export const RAINBOW_DEMO_HTML = `
<details class="dbg-compare dbg-rainbow">
  <summary>Rainbow (S-tier flowing gradient)</summary>
  <div class="dbg-rainbow-list">
    <label><input type="checkbox" name="rainbow-respect" /> Respect reduced motion</label>
    <label>Cycle <input type="range" name="rainbow-speed" min="1" max="40" step="1" value="4" aria-label="Rainbow cycle length in seconds" /><span class="dbg-rainbow-secs">4s</span></label>
    <div class="dbg-rainbow-row">
      <span class="dbg-rainbow-slot rainbow-frame rainbow-glow"><span class="dbg-rainbow-item"></span></span>
      <span>S-tier item frame</span>
    </div>
    <p class="rainbow dbg-rainbow-big">S-tier loot</p>
    <div class="dbg-rainbow-bar"><span class="rainbow-fill"></span></div>
    <p class="rainbow dbg-rainbow-big">-12.3K</p>
    <p class="dbg-rainbow-js">JS smooth: <b class="rainbow-outline"></b></p>
    <canvas width="48" height="9" aria-label="Stepped rainbow swatch"></canvas>
    <p class="dbg-stats dbg-rainbow-note"></p>
  </div>
</details>`;

/**
 * Wires the section in `root`: the speed slider and the JS-drawn parts (the
 * CSS parts need no JS). The frame loop only runs while the section is open.
 * With `prefers-reduced-motion` the demo still animates (so it can be seen),
 * unless "Respect reduced motion" is ticked: then everything is still, like in
 * the game. Returns a function that stops everything.
 */
export function mountRainbowDemo(root: HTMLElement): () => void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const details = q<HTMLDetailsElement>('.dbg-rainbow');
  const slider = q<HTMLInputElement>('[name="rainbow-speed"]');
  const secs = q<HTMLSpanElement>('.dbg-rainbow-secs');
  const js = q<HTMLElement>('.dbg-rainbow-js b');
  const canvas = q<HTMLCanvasElement>('.dbg-rainbow canvas');
  const respect = q<HTMLInputElement>('[name="rainbow-respect"]');
  const note = q<HTMLElement>('.dbg-rainbow-note');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)');

  const periodMs = () => Number(slider.value) * 1000;
  let raf = 0;
  let lastStep = '';

  /** Canvas at 48x9 px shown 4x: a big chip with the current stop, then every stop. */
  function draw(t: number, force = false): void {
    const p = periodMs();
    const step = rainbowStep(t, p);
    const smooth = rainbowColor(t, p);
    js.textContent = smooth;
    js.style.color = smooth;
    if (!ctx || (!force && step === lastStep)) return;
    lastStep = step;
    const fg = getComputedStyle(canvas).getPropertyValue('--_fg').trim() || 'currentColor';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = step;
    ctx.fillRect(0, 0, 9, 9);
    SWATCH_HUES.forEach((h, i) => {
      const c = rainbowHsl(h);
      ctx.fillStyle = c;
      ctx.fillRect(11 + i * 3, 3, 2, 3);
      if (c === step) {
        ctx.fillStyle = fg;
        ctx.fillRect(11 + i * 3, 7, 2, 1);
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
    const system = reduced?.matches ?? false;
    const still = system && respect.checked;
    details.classList.toggle('dbg-rainbow-motion', !respect.checked);
    note.textContent = !system
      ? 'System: reduced motion is off. Animating.'
      : still
        ? 'System prefers reduced motion. Respected: animation is off.'
        : 'System prefers reduced motion. Demo overrides it: animating.';
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
  respect.addEventListener('change', sync);
  reduced?.addEventListener?.('change', sync);
  sync();

  return () => {
    stop();
    details.removeEventListener('toggle', sync);
    respect.removeEventListener('change', sync);
    reduced?.removeEventListener?.('change', sync);
  };
}
