import { COMPANION_IDS, COMPANIONS } from '../game/balance';
import type { Progress } from '../game/state';
import {
  decodeSave,
  encodeSave,
  loadSave,
  SAVE_PREFIX,
  type AudioSettings,
  type SaveData,
} from '../save';
import { buildSaveLink } from '../save-link';
import { html, setFlag } from './dom';

// ── Pure parts ───────────────────────────────────────────────────────────────

export type Parsed =
  { ok: true; progress: Progress; audio: Partial<AudioSettings> } | { ok: false; error: string };

export const SAVE_ERRORS = {
  empty: 'Paste a save string first.',
  notSave: `Not a save string. It should start with ${SAVE_PREFIX}.`,
  checksum: "Checksum doesn't match: the save is damaged or was edited.",
  notJsonSave: 'Not a save: this JSON has no world and stage.',
} as const;

/**
 * Reads pasted or uploaded save text: a save string (`decodeSave`: format,
 * checksum, strict schema) or a plain-JSON v1 save (repaired like `loadSave`
 * does). Pure, never throws.
 */
export function parseSaveText(text: string, tracks?: readonly string[]): Parsed {
  const t = text.trim();
  if (!t) return { ok: false, error: SAVE_ERRORS.empty };
  if (t.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(t);
    } catch {
      return { ok: false, error: SAVE_ERRORS.notSave };
    }
    const d = data as Record<string, unknown> | null;
    if (!d || typeof d.world !== 'number' || typeof d.stage !== 'number') {
      return { ok: false, error: SAVE_ERRORS.notJsonSave };
    }
    const { saved } = loadSave({ getItem: () => t }, 'import');
    return saved ? { ok: true, ...saved } : { ok: false, error: SAVE_ERRORS.notJsonSave };
  }
  const r = decodeSave(t, tracks);
  if (r.ok) return { ok: true, progress: r.progress, audio: r.audio };
  const first = r.errors[0] ?? '';
  if (first.startsWith('Not a save string')) return { ok: false, error: SAVE_ERRORS.notSave };
  if (first.startsWith('Checksum')) return { ok: false, error: SAVE_ERRORS.checksum };
  return { ok: false, error: `This save has problems: ${r.errors.join(' ')}` };
}

/** "Stage 3.4, 12,400 coins, crow, 2 items" */
export function savePreviewText(p: Progress): string {
  const g = p.items;
  const items = g.bag.length + (g.ring ? 1 : 0) + (g.pendant ? 1 : 0);
  const owned = COMPANION_IDS.filter((id) => p.companions[id] >= 1);
  const companion = owned.length
    ? owned.map((id) => COMPANIONS[id].name.toLowerCase()).join(' + ')
    : 'no companion';
  return [
    `Stage ${p.world}.${p.stage}`,
    `${p.coins.toLocaleString('en-US')} coins`,
    companion,
    `${items} ${items === 1 ? 'item' : 'items'}`,
  ].join(', ');
}

/** `afk-save-YYYY-MM-DD.txt` in local time. */
export function saveFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `afk-save-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`;
}

/** The parsed save as full save data; audio the save doesn't set keeps the current values. */
export function toImport(current: SaveData, parsed: Extract<Parsed, { ok: true }>): SaveData {
  return { ...current, ...parsed.progress, audio: { ...current.audio, ...parsed.audio } };
}

/** Error for a `#save=` link that doesn't hold a valid save. */
export const linkError = (error: string) => `This save link doesn't work. ${error}`;

// ── DOM ──────────────────────────────────────────────────────────────────────

export type SavePanelDeps = {
  /** The current game as save data. */
  read(): SaveData;
  /** Backs up the current save, writes `data` and restarts from it. Errors, or null. */
  apply(data: SaveData): string[] | null;
  tracks?: readonly string[];
  /**
   * A save string from a `#save=` link: offered for loading as soon as the
   * panel exists. `done` runs once it is loaded, cancelled or rejected.
   */
  link?: { save: string; done(): void } | null;
};

export type SavePanel = { el: HTMLElement; refresh(): void };

const MARKUP = `
  <div class="save-panel">
    <h3>Save</h3>
    <p class="note">The checksum only catches typos. Saves aren't secret: anyone can read or edit them.</p>
    <textarea class="save-out" readonly rows="3" spellcheck="false" aria-label="Your save string"></textarea>
    <div class="buy-row">
      <button type="button" data-save="copy">Copy</button>
      <button type="button" data-save="download">Download</button>
      <button type="button" data-save="link">Copy link</button>
    </div>
    <h3>Load</h3>
    <textarea class="save-in" rows="3" spellcheck="false" placeholder="Paste a save string" aria-label="Save string to load"></textarea>
    <div class="buy-row">
      <button type="button" data-save="upload">Upload .txt</button>
      <input type="file" accept=".txt,text/plain" hidden />
    </div>
    <p class="save-msg" role="status" aria-live="polite"></p>
    <div class="buy-row save-confirm" hidden>
      <button type="button" data-save="confirm">Load this save</button>
      <button type="button" data-save="cancel">Cancel</button>
    </div>
  </div>`;

/** Save export/import for Menu → Help. */
export function createSavePanel(deps: SavePanelDeps): SavePanel {
  const el = html(MARKUP);
  const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const out = $<HTMLTextAreaElement>('.save-out');
  const input = $<HTMLTextAreaElement>('.save-in');
  const file = $<HTMLInputElement>('input[type="file"]');
  const msg = $('.save-msg');
  const confirmRow = $('.save-confirm');
  let pending: SaveData | null = null;
  let linkDone: (() => void) | null = null;

  function refresh(): string {
    out.value = encodeSave(deps.read());
    return out.value;
  }

  function say(text: string, error = false): void {
    msg.textContent = text;
    msg.classList.toggle('error', error);
  }

  /** Previews the pasted save and asks to confirm. Returns the error, if any. */
  function check(): string | null {
    pending = null;
    setFlag(confirmRow, 'hidden', true);
    if (!input.value.trim()) {
      say('');
      return null;
    }
    const r = parseSaveText(input.value, deps.tracks);
    if (!r.ok) {
      say(r.error, true);
      return r.error;
    }
    pending = toImport(deps.read(), r);
    say(`${savePreviewText(r.progress)}. Load it? It replaces your current game.`);
    setFlag(confirmRow, 'hidden', false);
    return null;
  }

  function finishLink(): void {
    const done = linkDone;
    linkDone = null;
    done?.();
  }

  async function copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      out.value = text;
      out.select(); // no clipboard access: select it for Ctrl+C
      return say(`Select the ${what} and copy it.`);
    }
    say('Copied.');
  }

  function download(): void {
    const url = URL.createObjectURL(new Blob([refresh()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = saveFileName(new Date());
    el.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function load(): void {
    if (!pending) return;
    const errors = deps.apply(pending);
    if (errors) return say(errors.join(' '), true);
    input.value = '';
    pending = null;
    setFlag(confirmRow, 'hidden', true);
    refresh();
    say('Loaded. Your previous save is kept as the backup.');
    finishLink();
  }

  if (deps.link) {
    linkDone = deps.link.done;
    input.value = deps.link.save;
    const error = check();
    if (error) {
      input.value = '';
      say(linkError(error), true);
      finishLink();
    }
  }

  input.addEventListener('input', check);
  out.addEventListener('focus', () => {
    refresh();
    out.select();
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    input.value = await f.text();
    check();
  });
  el.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLElement>('[data-save]')?.dataset.save;
    if (act === 'copy') void copy(refresh(), 'text');
    else if (act === 'link') void copy(buildSaveLink(location.href, refresh()), 'link');
    else if (act === 'download') download();
    else if (act === 'upload') file.click();
    else if (act === 'confirm') load();
    else if (act === 'cancel') {
      input.value = '';
      check();
      finishLink();
    }
  });

  return { el, refresh: () => void refresh() };
}
