import { WEAPONS } from '../game/balance';
import type { SaveData } from '../save';

/** What the debugger needs from the running game. */
export type DebugApi = {
  /** Everything the game would save right now. */
  read(): SaveData;
  /** Validates and loads `data` into the running game. Returns errors, or null on success. */
  apply(data: unknown): string[] | null;
  /** Clears the save and restarts from 1.1. */
  reset(): void;
};

export type DebugPanel = {
  setStats(text: string): void;
  destroy(): void;
};

type Field =
  | { key: string; label: string; kind: 'int' }
  | { key: string; label: string; kind: 'volume' }
  | { key: string; label: string; kind: 'bool' }
  | { key: string; label: string; kind: 'track' };

const FIELDS: Field[] = [
  { key: 'world', label: 'World', kind: 'int' },
  { key: 'stage', label: 'Stage (1–6)', kind: 'int' },
  { key: 'best', label: 'Highest stage reached (level)', kind: 'int' },
  { key: 'coins', label: 'Coins', kind: 'int' },
  ...WEAPONS.map((w, i): Field => ({
    key: `weaponLevels.${i}`,
    label: `${w.name} level`,
    kind: 'int',
  })),
  { key: 'equipped', label: 'Equipped weapon (0–4)', kind: 'int' },
  { key: 'autoAdvance', label: 'Auto-advance', kind: 'bool' },
  { key: 'kills', label: 'Kills', kind: 'int' },
  { key: 'deaths', label: 'Deaths', kind: 'int' },
  { key: 'audio.muted', label: 'Muted', kind: 'bool' },
  { key: 'audio.track', label: 'Music track', kind: 'track' },
  { key: 'audio.musicVolume', label: 'Music volume (0–1)', kind: 'volume' },
  { key: 'audio.sfxVolume', label: 'Effects volume (0–1)', kind: 'volume' },
];

const STYLES = `
.dbg {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 2;
  max-width: min(340px, calc(100% - 24px));
  max-height: calc(100% - 90px);
  overflow: auto;
  background: var(--_bg);
  border: 3px solid var(--_fg);
  font-size: 12px;
}
.dbg summary { cursor: pointer; padding: 4px 8px; font-weight: bold; }
.dbg[open] summary { border-bottom: 3px solid var(--_fg); }
.dbg-body { padding: 6px 8px 8px; display: grid; gap: 6px; }
.dbg-stats { margin: 0; white-space: pre-wrap; opacity: 0.8; }
.dbg-form { display: grid; grid-template-columns: 1fr 96px; gap: 3px 8px; align-items: center; }
.dbg-form input, .dbg-form select, .dbg textarea {
  font: inherit;
  color: var(--_fg);
  background: var(--_bg);
  border: 3px solid var(--_fg);
  border-radius: 0;
  padding: 1px 4px;
  min-width: 0;
}
.dbg-form input[type='checkbox'] { justify-self: start; accent-color: var(--_fg); }
.dbg textarea { width: 100%; height: 120px; resize: vertical; }
.dbg-row { display: flex; flex-wrap: wrap; gap: 6px; }
.dbg-row button { font-size: 12px; padding: 2px 8px; }
.dbg-err { margin: 0; color: var(--_red); white-space: pre-wrap; }
.dbg-ok { margin: 0; color: var(--_green); }
.dbg [hidden] { display: none; }
`;

/**
 * Bottom-left debugger: live stats, reset, and an editor for every saved
 * value (form + raw JSON). Collapsed by default so it doesn't cover the
 * fight. All changes go through `api.apply`, which validates first.
 */
export function createDebugPanel(
  parent: HTMLElement,
  api: DebugApi,
  tracks: readonly string[],
): DebugPanel {
  const style = document.createElement('style');
  style.textContent = STYLES;
  const el = document.createElement('details');
  el.className = 'dbg';
  el.innerHTML = `
    <summary>Debug</summary>
    <div class="dbg-body">
      <pre class="dbg-stats"></pre>
      <div class="dbg-row">
        <button type="button" data-dbg="load">Load current</button>
        <button type="button" data-dbg="reset">Reset all progress</button>
      </div>
      <div class="dbg-row dbg-confirm" hidden>
        <span>Clear the save and restart from 1.1?</span>
        <button type="button" data-dbg="reset-yes">Yes, reset</button>
        <button type="button" data-dbg="reset-no">Cancel</button>
      </div>
      <form class="dbg-form">${FIELDS.map(fieldHtml).join('')}</form>
      <div class="dbg-row"><button type="button" data-dbg="apply-form">Apply fields</button></div>
      <label>Raw save JSON<textarea spellcheck="false" aria-label="Raw save JSON"></textarea></label>
      <div class="dbg-row"><button type="button" data-dbg="apply-json">Apply JSON</button></div>
      <p class="dbg-err" role="alert" hidden></p>
      <p class="dbg-ok" role="status" hidden></p>
    </div>`;
  parent.append(style, el);

  const $ = <T extends Element>(sel: string) => el.querySelector<T>(sel)!;
  const stats = $<HTMLPreElement>('.dbg-stats');
  const form = $<HTMLFormElement>('.dbg-form');
  const textarea = $<HTMLTextAreaElement>('textarea');
  const confirmRow = $<HTMLDivElement>('.dbg-confirm');
  const err = $<HTMLParagraphElement>('.dbg-err');
  const ok = $<HTMLParagraphElement>('.dbg-ok');

  function fieldHtml(f: Field): string {
    const id = `dbg-${f.key.replace(/\./g, '-')}`;
    const input =
      f.kind === 'bool'
        ? `<input id="${id}" name="${f.key}" type="checkbox" />`
        : f.kind === 'track'
          ? `<select id="${id}" name="${f.key}">${tracks
              .map((t) => `<option value="${t}">${t || 'off'}</option>`)
              .join('')}</select>`
          : `<input id="${id}" name="${f.key}" type="text" inputmode="decimal" autocomplete="off" />`;
    return `<label for="${id}">${f.label}</label>${input}`;
  }

  function control(key: string): HTMLInputElement | HTMLSelectElement {
    return form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
  }

  function load(): void {
    const data = api.read();
    for (const f of FIELDS) {
      const value = get(data, f.key);
      const c = control(f.key);
      if (f.kind === 'bool') (c as HTMLInputElement).checked = value === true;
      else c.value = String(value);
    }
    textarea.value = JSON.stringify(data, null, 2);
    message(null);
  }

  /** Form → save object. Empty or non-numeric fields become NaN so validation rejects them. */
  function fromForm(): unknown {
    const data: Record<string, unknown> = { ...api.read(), weaponLevels: [], audio: {} };
    for (const f of FIELDS) {
      const c = control(f.key);
      const raw = c.value.trim();
      const value =
        f.kind === 'bool'
          ? (c as HTMLInputElement).checked
          : f.kind === 'track'
            ? c.value
            : raw === ''
              ? Number.NaN
              : Number(raw);
      set(data, f.key, value);
    }
    return data;
  }

  function apply(data: unknown): void {
    const errors = api.apply(data);
    if (errors) {
      message(errors);
    } else {
      load();
      message(null, 'Applied.');
    }
  }

  function message(errors: string[] | null, success?: string): void {
    err.hidden = !errors;
    err.textContent = errors ? `Not applied:\n${errors.map((e) => `• ${e}`).join('\n')}` : '';
    ok.hidden = !success;
    ok.textContent = success ?? '';
  }

  el.addEventListener('toggle', () => {
    if (el.open) load();
  });

  el.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLElement>('[data-dbg]')?.dataset.dbg;
    switch (act) {
      case 'load':
        load();
        return;
      case 'reset':
        confirmRow.hidden = false;
        return;
      case 'reset-no':
        confirmRow.hidden = true;
        return;
      case 'reset-yes':
        confirmRow.hidden = true;
        api.reset();
        load();
        message(null, 'Progress reset to 1.1.');
        return;
      case 'apply-form':
        apply(fromForm());
        return;
      case 'apply-json': {
        let data: unknown;
        try {
          data = JSON.parse(textarea.value);
        } catch (e) {
          message([`Invalid JSON: ${(e as Error).message}`]);
          return;
        }
        apply(data);
        return;
      }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    apply(fromForm());
  });

  return {
    setStats(text) {
      if (el.open && stats.textContent !== text) stats.textContent = text;
    },
    destroy() {
      el.remove();
      style.remove();
    },
  };
}

function get(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

function set(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let o: Record<string, unknown> = obj;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = value;
}
