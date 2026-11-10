import { capRain, RAIN_MAX_LINES, type RainCounts } from '../game/rain';

/** Debug panel section "Item rain": preview the background rain without items. */
export const RAIN_DEMO_STYLES = `
.dbg-rain summary { padding: 0; font-weight: normal; }
.dbg-rain[open] summary { border: 0; margin-bottom: 6px; }
.dbg-rain-body { display: grid; gap: 6px; }
.dbg-rain-body label { display: flex; gap: 8px; align-items: center; }
.dbg-rain-body input[type='number'] { width: 56px; }
.dbg-rain-body input[type='checkbox'] { accent-color: var(--_fg); }
.dbg-rain-body p { margin: 0; }
`;

export const RAIN_DEMO_HTML = `
<details class="dbg-compare dbg-rain">
  <summary>Item rain (equipped S and S+ items)</summary>
  <div class="dbg-rain-body">
    <label><input type="checkbox" name="rain-on" /> Preview rain (instead of the equipped items)</label>
    <label>S+ lines (rainbow) <input type="number" name="rain-rainbow" min="0" max="${RAIN_MAX_LINES}" step="1" value="2" /></label>
    <label>S lines (yellow) <input type="number" name="rain-yellow" min="0" max="${RAIN_MAX_LINES}" step="1" value="2" /></label>
    <p class="dbg-stats dbg-rain-note"></p>
  </div>
</details>`;

/** What the section shows: counts from the two boxes, capped; `null` while the toggle is off. */
export function rainPreviewCounts(on: boolean, rainbow: number, yellow: number): RainCounts | null {
  return on ? capRain(rainbow, yellow) : null;
}

/**
 * Wires the section in `root`. `onChange` gets the counts to preview, or
 * `null` to go back to the equipped items. Off by default, not remembered.
 */
export function mountRainDemo(root: HTMLElement, onChange: (c: RainCounts | null) => void): void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const on = q<HTMLInputElement>('[name="rain-on"]');
  const rainbow = q<HTMLInputElement>('[name="rain-rainbow"]');
  const yellow = q<HTMLInputElement>('[name="rain-yellow"]');
  const note = q<HTMLElement>('.dbg-rain-note');

  const update = (notify: boolean): void => {
    const counts = rainPreviewCounts(on.checked, Number(rainbow.value), Number(yellow.value));
    note.textContent = counts
      ? `Showing ${counts.rainbow} rainbow + ${counts.yellow} yellow (at most ${RAIN_MAX_LINES} lines; rainbow first).`
      : 'Off: the rain follows the equipped items.';
    if (notify) onChange(counts);
  };
  for (const input of [on, rainbow, yellow]) input.addEventListener('input', () => update(true));
  update(false);
}
