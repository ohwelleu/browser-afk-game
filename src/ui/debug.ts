import {
  COMPANIONS,
  companionAutoInterval,
  companionDamage,
  companionMaxSpeedLevel,
  isBoss,
  ITEM_SLOTS,
  ITEM_TIERS,
  ITEMS,
  WEAPONS,
  type ItemSlot,
  type ItemTier,
} from '../game/balance';
import { formatNumber } from '../game/format';
import { forceNextDrop, gearTotals, rollItem } from '../game/items';
import { heroDefence } from '../game/state';
import {
  crispSize,
  DEFAULT_FONT,
  FONT_CANDIDATES,
  FONT_STACK,
  fontFamily,
  loadCandidate,
  uiFontVars,
  useFont,
  type FontCandidate,
} from './font';
import { mountRainbowDemo, RAINBOW_DEMO_HTML, RAINBOW_DEMO_STYLES } from './rainbow-demo';
import {
  backupKey,
  decodeSave,
  DEFAULT_SAVE_KEY,
  encodeSave,
  loadSave,
  SAVE_PREFIX,
  type LoadStatus,
  type SaveData,
} from '../save';

/** What the debugger needs from the running game. */
export type DebugApi = {
  /** Everything the game would save right now. */
  read(): SaveData;
  /** Validates and loads `data` into the running game. Returns errors, or null on success. */
  apply(data: unknown): string[] | null;
  /** Clears the save and restarts from 1.1. */
  reset(): void;
};

/** Optional wiring; the defaults fit the demo page. */
export type DebugOptions = {
  /** localStorage key of the save (the game's `save-key`). */
  saveKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload?: () => void;
  /** Where the font picker's candidate files live (default: `fonts/` next to the page). */
  fontBase?: string;
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
  ...WEAPONS.map((w, i): Field => ({
    key: `revealedWeapons.${i}`,
    label: `${w.name} shown in shop`,
    kind: 'bool',
  })),
  { key: 'equipped', label: 'Equipped weapon (0–4)', kind: 'int' },
  { key: 'autoAdvance', label: 'Auto-advance', kind: 'bool' },
  { key: 'kills', label: 'Kills', kind: 'int' },
  { key: 'deaths', label: 'Deaths', kind: 'int' },
  { key: 'maxDps', label: 'Max DPS', kind: 'int' },
  { key: 'companion.owned', label: 'Crow owned', kind: 'bool' },
  { key: 'companion.dmgLevel', label: 'Crow damage level', kind: 'int' },
  { key: 'companion.autoUnlocked', label: 'Crow auto attack', kind: 'bool' },
  {
    key: 'companion.speedLevel',
    label: `Crow speed level (1–${companionMaxSpeedLevel(COMPANIONS.crow)})`,
    kind: 'int',
  },
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
  font-size: var(--afk-fs-small, 12px);
}
.dbg summary { cursor: pointer; padding: 4px 8px; font-weight: bold; }
.dbg[open] summary { border-bottom: 3px solid var(--_fg); }
.dbg-body { padding: 6px 8px 8px; display: grid; gap: 6px; }
.dbg-stats { margin: 0; white-space: pre-wrap; opacity: 0.8; }
.dbg-form { display: grid; grid-template-columns: 1fr 96px; gap: 3px 8px; align-items: center; }
.dbg-form input, .dbg select, .dbg textarea {
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
.dbg textarea.dbg-str { height: 48px; word-break: break-all; }
.dbg-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dbg-row button { font-size: var(--afk-fs-small, 12px); padding: 2px 8px; }
.dbg-font { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; }
.dbg-sample { margin: 0; font-size: var(--afk-fs, 16px); overflow-wrap: anywhere; }
.dbg-font-info { overflow-wrap: anywhere; }
.dbg-compare summary { padding: 0; font-weight: normal; }
.dbg-compare[open] summary { border: 0; margin-bottom: 6px; }
.dbg-compare-list { display: grid; gap: 8px; }
.dbg-compare-row { display: grid; gap: 2px; border-top: 3px solid var(--_fg); padding-top: 6px; }
.dbg-compare-head { display: flex; gap: 6px; align-items: center; justify-content: space-between; }
.dbg-compare-head button { font-size: var(--afk-fs-small, 12px); padding: 0 6px; }
.dbg-compare-row p { margin: 0; overflow-wrap: anywhere; }
.dbg-err { margin: 0; color: var(--_red); white-space: pre-wrap; }
.dbg-ok { margin: 0; color: var(--_green); }
.dbg [hidden] { display: none; }
${RAINBOW_DEMO_STYLES}`;

/**
 * Bottom-left debugger: live stats, reset, an editor for every saved value
 * (form + raw JSON), item tools, and the save string with its backup.
 * Collapsed by default so it doesn't cover the fight. Every change goes
 * through `api.apply`, which validates first.
 */
export function createDebugPanel(
  parent: HTMLElement,
  api: DebugApi,
  tracks: readonly string[],
  options: DebugOptions = {},
): DebugPanel {
  const key = options.saveKey ?? DEFAULT_SAVE_KEY;
  const storage = options.storage !== undefined ? options.storage : safeStorage();
  const reload = options.reload ?? (() => location.reload());
  /** How the game loaded this page (it hasn't written since). */
  const pageLoad = loadSave(storage ?? undefined, key).status;
  /** `items.nextId` when "force drop" was armed; null when not armed. */
  let forcedAt: number | null = null;
  let pending: (() => void) | null = null;

  const style = document.createElement('style');
  style.textContent = STYLES;
  const el = document.createElement('details');
  el.className = 'dbg';
  el.innerHTML = `
    <summary>Debug</summary>
    <div class="dbg-body">
      <pre class="dbg-stats dbg-live"></pre>
      <label class="dbg-font">Font<select name="font">${fontOptionsHtml()}</select></label>
      <p class="dbg-sample">${FONT_SAMPLE}<br />${FONT_LETTERS}</p>
      <p class="dbg-stats dbg-font-info"></p>
      <details class="dbg-compare">
        <summary>Compare all fonts</summary>
        <div class="dbg-compare-list">${FONT_CANDIDATES.map(compareRowHtml).join('')}</div>
      </details>${RAINBOW_DEMO_HTML}
      <div class="dbg-row">
        <button type="button" data-dbg="load">Load current</button>
        <button type="button" data-dbg="reset">Reset all progress</button>
      </div>
      <div class="dbg-row dbg-confirm" hidden>
        <span class="dbg-ask"></span>
        <button type="button" data-dbg="confirm-yes">Yes</button>
        <button type="button" data-dbg="confirm-no">Cancel</button>
      </div>
      <form class="dbg-form">${FIELDS.map(fieldHtml).join('')}</form>
      <div class="dbg-row"><button type="button" data-dbg="apply-form">Apply fields</button></div>
      <div class="dbg-row">
        <select name="slot" aria-label="Item slot">${ITEM_SLOTS.map((s) => `<option>${s}</option>`).join('')}</select>
        <select name="tier" aria-label="Item tier">${ITEM_TIERS.map((t) => `<option>${t}</option>`).join('')}</select>
        <button type="button" data-dbg="give">Give item</button>
      </div>
      <div class="dbg-row">
        <button type="button" data-dbg="force">Force drop on next kill</button>
        <button type="button" data-dbg="clear-bag">Clear bag</button>
      </div>
      <label>Raw save JSON<textarea class="dbg-json" spellcheck="false" aria-label="Raw save JSON"></textarea></label>
      <div class="dbg-row"><button type="button" data-dbg="apply-json">Apply JSON</button></div>
      <label>Save string<textarea class="dbg-str" readonly spellcheck="false" aria-label="Save string"></textarea></label>
      <pre class="dbg-stats dbg-backup"></pre>
      <div class="dbg-row">
        <button type="button" data-dbg="copy">Copy save string</button>
        <button type="button" data-dbg="corrupt">Corrupt main save + reload</button>
      </div>
      <p class="dbg-err" role="alert" hidden></p>
      <p class="dbg-ok" role="status" hidden></p>
    </div>`;
  parent.append(style, el);

  const $ = <T extends Element>(sel: string) => el.querySelector<T>(sel)!;
  const stats = $<HTMLPreElement>('.dbg-live');
  const form = $<HTMLFormElement>('.dbg-form');
  const textarea = $<HTMLTextAreaElement>('.dbg-json');
  const saveString = $<HTMLTextAreaElement>('.dbg-str');
  const backup = $<HTMLPreElement>('.dbg-backup');
  const slotSelect = $<HTMLSelectElement>('[name="slot"]');
  const tierSelect = $<HTMLSelectElement>('[name="tier"]');
  const confirmRow = $<HTMLDivElement>('.dbg-confirm');
  const ask = $<HTMLSpanElement>('.dbg-ask');
  const err = $<HTMLParagraphElement>('.dbg-err');
  const ok = $<HTMLParagraphElement>('.dbg-ok');
  const fontSelect = $<HTMLSelectElement>('[name="font"]');
  const fontInfo = $<HTMLParagraphElement>('.dbg-font-info');
  const fontBase = options.fontBase ?? new URL('fonts/', document.baseURI).href;

  /** Loads `f`, then switches every text on this game (and canvas text) to it. */
  function pickFont(f: FontCandidate, remember: boolean): void {
    fontSelect.value = f.id;
    fontInfo.textContent = `Loading ${f.label}…`;
    useFont(f, fontBase).then(
      () => {
        if (fontSelect.value !== f.id) return; // another pick came after this one
        styleFont(parent, f);
        fontInfo.textContent = fontInfoText(f);
        if (remember) {
          try {
            storage?.setItem(FONT_KEY, f.id);
          } catch {
            // storage blocked: the pick just isn't remembered
          }
        }
      },
      () => {
        if (fontSelect.value === f.id) fontInfo.textContent = `Could not load ${f.file ?? f.id}.`;
      },
    );
  }
  fontSelect.addEventListener('change', () => pickFont(findFont(fontSelect.value), true));

  // "Compare all fonts": loads every candidate the first time it opens; each
  // row shows the sample in its font at its crisp body size.
  const compare = $<HTMLDetailsElement>('.dbg-compare');
  let compareLoaded = false;
  compare.addEventListener('toggle', () => {
    if (!compare.open || compareLoaded) return;
    compareLoaded = true;
    for (const f of FONT_CANDIDATES) {
      const status = $<HTMLSpanElement>(`[data-compare-status="${f.id}"]`);
      status.textContent = 'loading…';
      loadCandidate(f, fontBase).then(
        () => (status.textContent = ''),
        () => (status.textContent = 'could not load'),
      );
    }
  });
  pickFont(findFont(storage?.getItem(FONT_KEY) ?? null), false);
  const stopRainbow = mountRainbowDemo(el);

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
    const view = toFormView(data);
    for (const f of FIELDS) {
      const value = get(view, f.key);
      const c = control(f.key);
      if (f.kind === 'bool') (c as HTMLInputElement).checked = value === true;
      else c.value = String(value);
    }
    textarea.value = JSON.stringify(data, null, 2);
    saveString.value = encodeSave(data);
    backup.textContent = storage
      ? saveStatus(storage, key, pageLoad, tracks)
      : 'Storage is blocked: nothing is saved.';
    message(null);
  }

  /** Form → save object. Empty or non-numeric fields become NaN so validation rejects them. */
  function fromForm(): unknown {
    const data: Record<string, unknown> = {
      ...api.read(),
      weaponLevels: [],
      revealedWeapons: [],
      audio: {},
      companion: {},
    };
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
    return fromFormView(data);
  }

  function apply(data: unknown, success = 'Applied.'): void {
    const errors = api.apply(data);
    if (errors) {
      message(errors);
    } else {
      load();
      message(null, success);
    }
  }

  function message(errors: string[] | null, success?: string): void {
    err.hidden = !errors;
    err.textContent = errors ? `Not applied:\n${errors.map((e) => `• ${e}`).join('\n')}` : '';
    ok.hidden = !success;
    ok.textContent = success ?? '';
  }

  function confirm(question: string, action: () => void): void {
    ask.textContent = question;
    pending = action;
    confirmRow.hidden = false;
  }

  /** Damages the main save, keeps it damaged through the game's unload save, reloads. */
  function corruptAndReload(): void {
    const raw = storage?.getItem(key);
    if (!storage || !raw) return message(['There is no main save yet.']);
    const bad = corruptSaveString(raw);
    const keep = () => {
      try {
        storage.setItem(key, bad);
      } catch {
        // storage blocked: nothing to do
      }
    };
    keep();
    // Added after the game's own listeners, so these run after its last save.
    window.addEventListener('pagehide', keep);
    document.addEventListener('visibilitychange', keep);
    reload();
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
      case 'use-font': {
        const id = (e.target as Element).closest<HTMLElement>('[data-font]')?.dataset.font;
        pickFont(findFont(id ?? null), true);
        return;
      }
      case 'reset':
        confirm('Clear the save and restart from 1.1?', () => {
          api.reset();
          load();
          message(null, 'Progress reset to 1.1.');
        });
        return;
      case 'confirm-no':
        confirmRow.hidden = true;
        pending = null;
        return;
      case 'confirm-yes': {
        confirmRow.hidden = true;
        const action = pending;
        pending = null;
        action?.();
        return;
      }
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
      case 'give': {
        const slot = slotSelect.value as ItemSlot;
        const tier = tierSelect.value as ItemTier;
        const data = giveItem(api.read(), slot, tier);
        if (typeof data === 'string') message([data]);
        else apply(data, `Gave a tier ${tier} ${slot}.`);
        return;
      }
      case 'force':
        forceNextDrop();
        forcedAt = api.read().items.nextId;
        message(null, 'The next kill drops an item.');
        return;
      case 'clear-bag':
        apply(clearBag(api.read()), 'Bag cleared.');
        return;
      case 'copy':
        saveString.value = encodeSave(api.read());
        saveString.select();
        if (!navigator.clipboard) return message(null, 'Selected: press Ctrl+C to copy.');
        navigator.clipboard.writeText(saveString.value).then(
          () => message(null, 'Save string copied.'),
          () => message(null, 'Selected: press Ctrl+C to copy.'),
        );
        return;
      case 'corrupt': {
        const bak = storage ? describeStored(storage.getItem(backupKey(key)), tracks) : 'missing';
        confirm(
          bak.startsWith('ok')
            ? `Damage the main save and reload? The backup (${bak}) should load.`
            : `Damage the main save and reload? The backup is ${bak}, so the game starts over.`,
          corruptAndReload,
        );
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
      if (!el.open) return;
      const data = api.read();
      if (forcedAt !== null && data.items.nextId !== forcedAt) forcedAt = null;
      const full = `${text}\n${extraStats(data, forcedAt !== null)}`;
      if (stats.textContent !== full) stats.textContent = full;
    },
    destroy() {
      stopRainbow();
      el.remove();
      style.remove();
    },
  };
}

/** Picker options: the shortlist first, then the other fonts checked. */
function fontOptionsHtml(): string {
  const group = (g: FontCandidate['group'], label: string) =>
    `<optgroup label="${label}">${FONT_CANDIDATES.filter((f) => f.group === g)
      .map((f) => `<option value="${f.id}">${fontLabel(f)}</option>`)
      .join('')}</optgroup>`;
  return group('shortlist', 'Shortlist') + group('more', 'More (checked, not shortlisted)');
}

/** One "Compare all fonts" row: name, a Use button and the sample in that font. */
function compareRowHtml(f: FontCandidate): string {
  const size = round2(f.snapUi ? crispSize(16, f) : 16);
  const style = `font-family: ${fontFamily(f)}, ${FONT_STACK}; font-size: ${size}px;`;
  return `<div class="dbg-compare-row">
    <div class="dbg-compare-head">
      <span>${fontLabel(f)} <span data-compare-status="${f.id}"></span></span>
      <button type="button" data-dbg="use-font" data-font="${f.id}">Use</button>
    </div>
    <p style="${style}">${FONT_SAMPLE}<br />${FONT_LETTERS}</p>
  </div>`;
}

/** Inline styles on the game box: family and crisp size variables. */
function styleFont(box: HTMLElement, f: FontCandidate): void {
  box.style.fontFamily = f.file ? `${fontFamily(f)}, ${FONT_STACK}` : '';
  for (const [k, v] of Object.entries(uiFontVars(f))) box.style.setProperty(k, v);
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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

// ── Pure helpers (exported for tests) ──────────────────────────────────────

/** localStorage key of the font picker's choice (debug only). */
export const FONT_KEY = 'afk-debug-font';
/** Every Lithuanian letter, digits and the number suffixes. */
export const FONT_SAMPLE = 'Ąžuolas čiulba: šešios ūsų ėdės — 1234567890 K M B';
/** The sample has no ę or į: every Lithuanian letter, both cases. */
export const FONT_LETTERS = 'ĄČĘĖĮŠŲŪŽ ąčęėįšųūž';

/** The candidate with `id`, or the default for unknown or missing ids. */
export const findFont = (id: string | null): FontCandidate =>
  FONT_CANDIDATES.find((f) => f.id === id) ?? DEFAULT_FONT;

/** Grid, licence and the px sizes the font gets, for the picker. */
export function fontInfoText(f: FontCandidate): string {
  const vars = uiFontVars(f);
  const ui = f.snapUi
    ? `UI ${[...new Set(Object.values(vars))].join(' ')}`
    : `UI ${[...new Set(Object.values(vars))].join(' ')} (old Pixelify sizes, not snapped)`;
  // Same sizes as scene.ts at a typical desktop scale of 4.
  const damage = round2(crispSize(4 * 5, f));
  const banner = round2(crispSize(Math.max(22, 4 * 7), f));
  const grid = f.grid === 1 ? 'no pixel grid' : `grid ${round2(f.grid)} px`;
  return [
    `${grid} · ${ui}`,
    `canvas (scale 4) damage ${damage} px, banner ${banner} px · ` +
      (f.bold ? 'has bold' : 'no bold (not faked)'),
    f.missing ? `MISSING ${f.missing} (shown in the game font)` : 'all Lithuanian letters',
    `${f.licence} · ${f.source}`,
  ].join('\n');
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Dropdown / compare label: name, grid, and a warning when letters are missing. */
export const fontLabel = (f: FontCandidate): string =>
  f.missing ? `${f.label} — no ${f.missing.split(' ')[0]}` : f.label;

const percent = (f: number): string => `${Math.round(f * 1000) / 10}%`;

/** Save → form values: the crow always has fields; `owned` says whether it exists. */
export function toFormView(data: SaveData): Record<string, unknown> {
  const c = data.companion;
  return {
    ...data,
    companion: {
      owned: c !== null,
      dmgLevel: c?.dmgLevel ?? 1,
      autoUnlocked: c?.autoUnlocked ?? false,
      speedLevel: c?.speedLevel ?? 1,
    },
  };
}

/** Form values → save object (the inverse of `toFormView`). */
export function fromFormView(view: Record<string, unknown>): Record<string, unknown> {
  const { owned, ...crow } = view.companion as Record<string, unknown>;
  return { ...view, companion: owned ? { id: 'crow', ...crow } : null };
}

/** Adds an item of `slot` and `tier`, rolled for the current stage, to the bag. */
export function giveItem(data: SaveData, slot: ItemSlot, tier: ItemTier): SaveData | string {
  const g = data.items;
  if (g.bag.length >= ITEMS.inventorySize) return `The bag is full (${ITEMS.inventorySize}).`;
  const rng = { state: g.rng };
  const item = rollItem(rng, g.nextId, data.world, data.stage, gearTotals(g).itemFind, {
    slot,
    tier,
  });
  return { ...data, items: { ...g, bag: [...g.bag, item], rng: rng.state, nextId: g.nextId + 1 } };
}

export const clearBag = (data: SaveData): SaveData => ({
  ...data,
  items: { ...data.items, bag: [] },
});

/** Live stat lines for the crow, the items and drops. */
export function extraStats(data: SaveData, dropForced = false): string {
  const c = data.companion;
  let crow = 'crow none';
  if (c) {
    const def = COMPANIONS[c.id];
    const dmg = companionDamage(def, c.dmgLevel);
    const every = companionAutoInterval(def, c.speedLevel);
    crow = c.autoUnlocked
      ? `crow dmg ${formatNumber(dmg)} every ${every.toFixed(1)}s dps ${formatNumber(dmg / every)}`
      : `crow dmg ${formatNumber(dmg)} dps 0 (no auto attack)`;
  }
  const t = gearTotals(data.items);
  const chance = isBoss(data.stage) ? ITEMS.dropChance.boss : ITEMS.dropChance.mob;
  const drop = dropForced ? '100% (forced)' : percent(chance);
  return (
    `${crow}\n` +
    `items dmg +${formatNumber(t.damage)} def +${formatNumber(t.defence)} (total ${formatNumber(heroDefence(data))}) ` +
    `spd +${percent(t.speed)} find +${percent(t.itemFind)}\n` +
    `drop ${drop} bag ${data.items.bag.length}/${ITEMS.inventorySize}`
  );
}

/** A damaged copy of a stored save: the checksum (or the JSON) no longer matches. */
export const corruptSaveString = (raw: string): string => `${raw}!`;

/** One stored save value, described for the backup status. */
export function describeStored(raw: string | null, tracks?: readonly string[]): string {
  if (!raw) return 'missing';
  if (!raw.startsWith(`${SAVE_PREFIX}.`)) return 'old JSON save';
  const r = decodeSave(raw, tracks);
  if (!r.ok) return `broken (${r.errors[0]})`;
  return `ok ${String(r.data.world)}.${String(r.data.stage)} v${String(r.data.gameVersion)}`;
}

const LOAD_LABELS: Record<LoadStatus, string> = {
  none: 'no save, new game',
  ok: 'main save',
  backup: 'BACKUP (main save was damaged)',
  reset: 'new game (main and backup damaged)',
};

/** Main save, backup and how this page loaded, one per line. */
export function saveStatus(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  pageLoad: LoadStatus,
  tracks?: readonly string[],
): string {
  return (
    `main: ${describeStored(storage.getItem(key), tracks)}\n` +
    `backup: ${describeStored(storage.getItem(backupKey(key)), tracks)}\n` +
    `page loaded: ${LOAD_LABELS[pageLoad]}`
  );
}
