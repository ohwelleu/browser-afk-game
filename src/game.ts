import { createAudio, TRACK_IDS } from './audio';
import type { SfxName } from './audio/types';
import { HERO_MAX_HP, isBoss, upgradeCost, weaponDamage, WEAPONS } from './game/balance';
import { formatNumber } from './game/format';
import {
  buyUpgrade,
  buyWeapon,
  canBuyWeapon,
  canUpgrade,
  createState,
  equip,
  heroDamage,
  nextWeapon,
  setAutoAdvance,
  update,
  type GameEvent,
  type GameState,
} from './game/state';
import { Loop } from './loop';
import { SceneRenderer, sceneContent } from './render/scene';
import { SpriteCache } from './render/sprites';
import { computeView, type View } from './render/view';
import { loadSave, readSavePreview, toSaveData, writeSave, type AudioSettings } from './save';
import { SfxMixer } from './sfx-mixer';
import { coinSpin, icons, type SpriteDef } from './sprites';
import { STYLES } from './styles';
import { buildPalette, resolveTheme, type Palette, type ThemeMode } from './theme';

export type GameOptions = {
  saveKey: string;
  theme: ThemeMode;
  debug: boolean;
};

export type GameHandle = {
  setTheme(mode: ThemeMode): void;
  destroy(): void;
};

const AUTOSAVE_MS = 5000;
/** CSS px kept free at the top of the canvas for the HUD. */
const HUD_HEIGHT = 64;
/** Music switch order; '' = off. */
const TRACK_CYCLE = [...TRACK_IDS, ''];
const trackName = (id: string) => (id ? id[0].toUpperCase() + id.slice(1) : 'Off');

const HTML = `
  <div class="box" part="box">
    <canvas aria-hidden="true"></canvas>
    <div class="hud">
      <div class="hud-left">
        <div class="hp" title="Hero HP">
          <span class="hp-icon" aria-hidden="true">♥</span>
          <div class="bar"><div class="bar-fill"></div></div>
          <span class="hp-text"></span>
        </div>
        <div class="coins" title="Coins"><img class="coin-icon" width="16" height="16" alt="" /><span class="coin-text"></span></div>
      </div>
      <div class="hud-center"><span class="stage"></span></div>
      <div class="hud-right">
        <button class="icon-btn" type="button" data-act="pause" aria-label="Pause">❚❚</button>
        <button class="icon-btn" type="button" data-act="music"><img width="24" height="24" alt="" /></button>
        <button class="icon-btn" type="button" data-act="mute" aria-label="Mute all sound"><img width="24" height="24" alt="" /></button>
        <button class="icon-btn" type="button" data-act="menu" aria-label="Menu" aria-haspopup="dialog">☰</button>
      </div>
    </div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="afk-menu-title" hidden>
      <div class="panel">
        <h2 id="afk-menu-title">Menu</h2>
        <button class="close" type="button" data-act="close" aria-label="Close menu">X</button>
        <h3>Upgrades</h3>
        <div class="row"><span class="up-info"></span><button type="button" data-act="upgrade"></button></div>
        <h3>Weapons</h3>
        <div class="row"><span class="shop-info"></span><button type="button" data-act="buy"></button></div>
        <h3>Inventory</h3>
        <ul class="inv">${WEAPONS.map(
          (_, i) =>
            `<li class="row"><span class="inv-info"></span><button type="button" data-act="equip" data-tier="${i}"></button></li>`,
        ).join('')}</ul>
        <h3>Auto-advance</h3>
        <label class="row" style="justify-content:flex-start"><input type="checkbox" data-act="auto" /> Go to the next stage after a win</label>
        <h3>Help &amp; credits</h3>
        <p>Your hunter duels one monster per stage and attacks on his own. Wins pay coins. Spend them on damage upgrades and new weapons. Every 6th stage is a boss. If the hunter falls, he steps back one stage and auto-advance turns off: upgrade, then turn it back on.</p>
        <p class="muted">browser-afk-game v${__VERSION__} · Sound effects: ZzFX by Frank Force (MIT)</p>
      </div>
    </div>
    <div class="overlay"><button class="start" type="button">Start</button></div>
    <div class="debug" hidden></div>
  </div>`;

/**
 * Wires one game instance into a shadow root: DOM, canvas sizing, theme,
 * HUD, menu, audio, save, loop and pause rules. Game rules live in `game/`.
 */
export function createGame(root: ShadowRoot, host: HTMLElement, opts: GameOptions): GameHandle {
  root.innerHTML = `<style>${STYLES}</style>${HTML}`;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const box = $('.box');
  const canvas = $<HTMLCanvasElement>('canvas');
  const overlay = $('.overlay');
  const startButton = $<HTMLButtonElement>('.start');
  const debugEl = $('.debug');
  const modal = $('.modal');
  const menuButton = $<HTMLButtonElement>('[data-act="menu"]');
  const pauseButton = $<HTMLButtonElement>('[data-act="pause"]');
  const musicButton = $<HTMLButtonElement>('[data-act="music"]');
  const muteButton = $<HTMLButtonElement>('[data-act="mute"]');
  const ctx = canvas.getContext('2d')!;

  const storage = safeLocalStorage();
  const preview = readSavePreview(storage, opts.saveKey);
  const saved = loadSave(storage, opts.saveKey);
  if (preview?.stage) startButton.textContent = `Continue · ${preview.stage}`;

  const colorScheme = matchMedia('(prefers-color-scheme: dark)');
  let themeMode = opts.theme;
  let palette: Palette = currentPalette();
  const sprites = new SpriteCache(palette);
  const scene = new SceneRenderer();
  const content = sceneContent();
  let state: GameState = createState(saved?.progress);
  let view: View = computeView(1, 1, 1, content);
  let started = false;
  let paused = false;
  let onScreen = true;
  let fpsFrames = 0;
  let fpsTime = performance.now();
  let fps = 0;

  const audioSettings: AudioSettings = {
    muted: saved?.audio.muted ?? false,
    track: TRACK_CYCLE.includes(saved?.audio.track ?? '-') ? saved!.audio.track! : TRACK_CYCLE[0],
  };
  const audio = createAudio();
  audio.setMuted(audioSettings.muted);
  audio.setTrack(audioSettings.track);
  const mixer = new SfxMixer();
  let pendingSfx: SfxName[] = [];

  const loop = new Loop((dt) => {
    state = update(state, dt);
    handleEvents(state.events);
  }, draw);

  function handleEvents(events: readonly GameEvent[]): void {
    let save = false;
    for (const e of events) {
      if (e.type === 'sfx') pendingSfx.push(e.name);
      else if (e.type === 'save') save = true;
    }
    scene.onEvents(state, events, view);
    if (save) saveNow();
  }

  /** Applies a pure action; ignored when the action didn't change anything. */
  function act(fn: (s: GameState) => GameState): void {
    const next = fn(state);
    if (next === state) return;
    state = next;
    handleEvents(state.events);
    refreshUi();
    if (!loop.running) draw();
  }

  function saveNow(): void {
    if (!started) return;
    writeSave(storage, opts.saveKey, toSaveData(state, audioSettings, __VERSION__));
  }

  // ── Theme & sizing ───────────────────────────────────────────────────────

  function currentPalette(): Palette {
    const theme = resolveTheme(themeMode, document.documentElement.classList, colorScheme.matches);
    const style = getComputedStyle(host);
    return buildPalette(theme, (name) => style.getPropertyValue(name));
  }

  function applyTheme(): void {
    palette = currentPalette();
    sprites.setPalette(palette);
    for (const [k, v] of Object.entries(palette)) box.style.setProperty(`--_${k}`, v);
    $<HTMLImageElement>('.coin-icon').src = iconUrl(coinSpin);
    refreshAudioButtons();
    if (!loop.running) draw();
  }

  function iconUrl(def: SpriteDef): string {
    return sprites.frame(def, 0).toDataURL();
  }

  function resize(): void {
    const rect = box.getBoundingClientRect();
    view = computeView(rect.width, rect.height, window.devicePixelRatio || 1, content, HUD_HEIGHT);
    if (canvas.width !== view.pxWidth) canvas.width = view.pxWidth;
    if (canvas.height !== view.pxHeight) canvas.height = view.pxHeight;
    // Resizing clears the canvas, so repaint even when paused.
    draw();
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  function draw(): void {
    if (pendingSfx.length) {
      for (const name of mixer.mix(pendingSfx, performance.now() / 1000)) audio.play(name);
      pendingSfx = [];
    }
    scene.draw(ctx, state, view, palette, sprites);
    refreshHud();
    if (!modal.hidden) refreshMenu();
    if (opts.debug) drawDebug();
  }

  const shown = new Map<Element, string>();
  /** Sets a property only when it changed, so per-frame refreshes stay cheap. */
  function show(el: Element, value: string, prop: 'textContent' | 'title' = 'textContent'): void {
    const key = `${prop}:${value}`;
    if (shown.get(el) === key) return;
    shown.set(el, key);
    (el as HTMLElement)[prop] = value;
  }

  function refreshHud(): void {
    const hp = state.duel.heroHp;
    const fill = $('.bar-fill');
    const pct = Math.max(0, Math.min(100, (hp / HERO_MAX_HP) * 100));
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct < 30);
    show($('.hp-text'), `${hp}/${HERO_MAX_HP}`);
    show($('.coin-text'), formatNumber(state.coins));
    const stage = $('.stage');
    show(stage, `${isBoss(state.stage) ? 'BOSS' : 'STAGE'} ${state.world}.${state.stage}`);
    stage.classList.toggle('boss', isBoss(state.stage));
  }

  function refreshMenu(): void {
    const tier = state.equipped;
    const level = state.weaponLevels[tier];
    const w = WEAPONS[tier];
    show(
      $('.up-info'),
      `${w.name} Lv ${level}: ${formatNumber(weaponDamage(tier, level))} → ${formatNumber(weaponDamage(tier, level + 1))} dmg`,
    );
    const up = $<HTMLButtonElement>('[data-act="upgrade"]');
    show(up, `Upgrade · ● ${formatNumber(upgradeCost(tier, level))}`);
    up.disabled = !canUpgrade(state);

    const nextTier = nextWeapon(state);
    const buy = $<HTMLButtonElement>('[data-act="buy"]');
    if (nextTier === null) {
      show($('.shop-info'), 'You own every weapon.');
      buy.hidden = true;
    } else {
      const nw = WEAPONS[nextTier];
      show($('.shop-info'), `${nw.name}: ${formatNumber(nw.baseDmg)} dmg at Lv 1`);
      show(buy, `Buy · ● ${formatNumber(nw.price)}`);
      buy.hidden = false;
      buy.disabled = !canBuyWeapon(state);
    }

    root.querySelectorAll<HTMLLIElement>('.inv li').forEach((li, i) => {
      const lvl = state.weaponLevels[i];
      const owned = lvl >= 1;
      li.classList.toggle('muted', !owned);
      show(
        li.querySelector('.inv-info')!,
        owned
          ? `${WEAPONS[i].name} · Lv ${lvl} · ${formatNumber(weaponDamage(i, lvl))} dmg`
          : `${WEAPONS[i].name} · not owned`,
      );
      const btn = li.querySelector('button')!;
      btn.hidden = !owned;
      show(btn, i === state.equipped ? 'Equipped' : 'Equip');
      btn.disabled = i === state.equipped;
    });

    $<HTMLInputElement>('[data-act="auto"]').checked = state.autoAdvance;
  }

  function refreshUi(): void {
    refreshHud();
    if (!modal.hidden) refreshMenu();
  }

  function refreshAudioButtons(): void {
    const name = trackName(audioSettings.track);
    const label = `Music: ${name} (switch track)`;
    musicButton.setAttribute('aria-label', label);
    show(musicButton, label, 'title');
    musicButton.querySelector('img')!.src = iconUrl(
      audioSettings.track ? icons.music : icons.musicOff,
    );
    muteButton.setAttribute('aria-pressed', String(audioSettings.muted));
    show(muteButton, audioSettings.muted ? 'Sound off (unmute)' : 'Sound on (mute)', 'title');
    muteButton.querySelector('img')!.src = iconUrl(audioSettings.muted ? icons.sfxOff : icons.sfx);
  }

  function drawDebug(): void {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsTime));
      fpsFrames = 0;
      fpsTime = now;
    }
    const d = state.duel;
    debugEl.textContent =
      `v${__VERSION__} ${loop.running ? 'running' : 'paused'} fps ${fps} scale ${view.scale}\n` +
      `${d.phase} t${d.tick} hero ${d.heroHp} mob ${d.mob.hp}/${d.mob.maxHp} ` +
      `dmg ${heroDamage(state)} vs ${d.mob.damage}`;
  }

  // ── Running / pausing ────────────────────────────────────────────────────

  /** Runs only after Start, while on screen, in a visible tab and not paused. */
  function syncRunning(): void {
    const shouldRun = started && !paused && onScreen && !document.hidden;
    if (shouldRun === loop.running) return;
    if (shouldRun) {
      loop.start();
      audio.resume();
    } else {
      loop.stop();
      audio.pause();
      draw();
    }
  }

  // ── Menu modal ───────────────────────────────────────────────────────────

  function openMenu(): void {
    modal.hidden = false;
    refreshMenu();
    $<HTMLButtonElement>('.close').focus();
  }

  function closeMenu(): void {
    if (modal.hidden) return;
    modal.hidden = true;
    menuButton.focus();
  }

  function focusables(): HTMLElement[] {
    return [...modal.querySelectorAll<HTMLElement>('button, input')].filter(
      (el) => !(el as HTMLButtonElement).disabled && !el.hidden && !el.closest('[hidden]'),
    );
  }

  box.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'Tab') {
      // Keep focus inside the modal.
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = root.activeElement;
      if (e.shiftKey && (active === first || !modal.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // ── Controls ─────────────────────────────────────────────────────────────

  box.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!target) {
      if (e.target === modal) closeMenu(); // click on the backdrop
      return;
    }
    switch (target.dataset.act) {
      case 'pause':
        paused = !paused;
        pauseButton.textContent = paused ? '▶' : '❚❚';
        pauseButton.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
        syncRunning();
        return;
      case 'music': {
        const i = TRACK_CYCLE.indexOf(audioSettings.track);
        audioSettings.track = TRACK_CYCLE[(i + 1) % TRACK_CYCLE.length];
        audio.setTrack(audioSettings.track);
        refreshAudioButtons();
        saveNow();
        return;
      }
      case 'mute':
        audioSettings.muted = !audioSettings.muted;
        audio.setMuted(audioSettings.muted);
        refreshAudioButtons();
        saveNow();
        return;
      case 'menu':
        if (modal.hidden) openMenu();
        else closeMenu();
        return;
      case 'close':
        closeMenu();
        return;
      case 'upgrade':
        act(buyUpgrade);
        return;
      case 'buy':
        act(buyWeapon);
        return;
      case 'equip':
        act((s) => equip(s, Number(target.dataset.tier)));
        return;
    }
  });

  $<HTMLInputElement>('[data-act="auto"]').addEventListener('change', (e) => {
    act((s) => setAutoAdvance(s, (e.target as HTMLInputElement).checked));
  });

  startButton.addEventListener('click', () => {
    if (started) return;
    started = true;
    overlay.hidden = true;
    void audio.start();
    saveNow();
    syncRunning();
  });

  const autosave = window.setInterval(() => {
    if (loop.running) saveNow();
  }, AUTOSAVE_MS);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  window.addEventListener('resize', resize); // catches devicePixelRatio changes (zoom)

  const intersectionObserver = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    syncRunning();
  });
  intersectionObserver.observe(host);

  function onVisibility(): void {
    if (document.hidden) saveNow();
    syncRunning();
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', saveNow);

  // `auto` theme: follow `<html class>` and the OS colour scheme.
  const htmlObserver = new MutationObserver(applyTheme);
  htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  colorScheme.addEventListener('change', applyTheme);

  debugEl.hidden = !opts.debug;
  applyTheme();
  resize();

  return {
    setTheme(mode) {
      themeMode = mode;
      applyTheme();
    },
    destroy() {
      saveNow();
      loop.stop();
      audio.pause();
      audio.setTrack('');
      window.clearInterval(autosave);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      htmlObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onVisibility);
      colorScheme.removeEventListener('change', applyTheme);
      root.innerHTML = '';
    },
  };
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
