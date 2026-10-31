import { AUDIO_DEFAULTS, createAudio, TRACK_IDS } from './audio';
import type { SfxName } from './audio/types';
import { HERO_MAX_HP, isBoss } from './game/balance';
import { formatNumber } from './game/format';
import {
  createState,
  heroDamage,
  setAutoAdvance,
  update,
  type GameEvent,
  type GameState,
} from './game/state';
import { Loop } from './loop';
import { SceneRenderer, sceneContent } from './render/scene';
import { SpriteCache } from './render/sprites';
import { computeView, type View } from './render/view';
import {
  loadSave,
  readSavePreview,
  toSaveData,
  validateSaveData,
  writeSave,
  type AudioSettings,
} from './save';
import { SfxMixer } from './sfx-mixer';
import { coinSpin, icons, type SpriteDef } from './sprites';
import { STYLES } from './styles';
import { buildPalette, resolveTheme, type Palette, type ThemeMode } from './theme';
import { createShow } from './ui/dom';
import { createMenu, MENU_STYLES } from './ui/menu';
import { Dialogs, MODAL_STYLES } from './ui/modal';
import { createSoundPanel, SOUND_STYLES } from './ui/sound';
import { createDebugPanel, type DebugPanel } from './ui/debug';

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
/** Below this box width the HUD buttons stack down the right edge and the scene goes compact. */
const COMPACT_WIDTH = 768;
/** CSS px the stacked HUD column takes on compact boxes (4 × 44 px buttons + gaps). */
const COMPACT_HUD_HEIGHT = 200;
/** CSS px kept free at the bottom on compact boxes for the AUTO toggle and the debugger. */
const COMPACT_BOTTOM = 64;
/** Music switch order; '' = off. */
const TRACK_CYCLE = [...TRACK_IDS, ''];
const trackName = (id: string) => (id ? id[0].toUpperCase() + id.slice(1) : 'Off');

const HTML = `
  <div class="box" part="box">
    <canvas aria-hidden="true"></canvas>
    <div class="hud">
      <div class="hud-left">
        <div class="hp" title="Hero HP">
          <div class="bar"><div class="bar-fill"></div></div>
          <span class="hp-text"></span>
        </div>
        <div class="coins" title="Coins"><img class="coin-icon" width="16" height="16" alt="" /><span class="coin-text"></span></div>
      </div>
      <div class="hud-center"><span class="stage"></span></div>
      <div class="hud-right">
        <button class="icon-btn" type="button" data-act="pause" aria-label="Pause">❚❚</button>
        <button class="icon-btn" type="button" data-act="music"><img width="24" height="24" alt="" /></button>
        <button class="icon-btn" type="button" data-act="sound" aria-label="Sound settings" aria-haspopup="dialog"><img width="24" height="24" alt="" /></button>
        <button class="icon-btn" type="button" data-act="menu" aria-label="Menu" aria-haspopup="dialog">☰</button>
      </div>
    </div>
    <button class="auto-btn toggle" type="button" data-act="auto" title="Auto-advance: go to the next stage after a win"></button>
    <div class="overlay"><button class="start" type="button">Start</button></div>
  </div>`;

/**
 * Wires one game instance into a shadow root: DOM, canvas sizing, theme,
 * HUD, menu, audio, save, loop and pause rules. Game rules live in `game/`.
 */
export function createGame(root: ShadowRoot, host: HTMLElement, opts: GameOptions): GameHandle {
  root.innerHTML = `<style>${STYLES}${MODAL_STYLES}${MENU_STYLES}${SOUND_STYLES}</style>${HTML}`;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const box = $('.box');
  const canvas = $<HTMLCanvasElement>('canvas');
  const overlay = $('.overlay');
  const startButton = $<HTMLButtonElement>('.start');
  const menuButton = $<HTMLButtonElement>('[data-act="menu"]');
  const soundButton = $<HTMLButtonElement>('[data-act="sound"]');
  const autoButton = $<HTMLButtonElement>('[data-act="auto"]');
  const pauseButton = $<HTMLButtonElement>('[data-act="pause"]');
  const musicButton = $<HTMLButtonElement>('[data-act="music"]');
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
  let state: GameState = createState(saved?.progress);
  let view: View = computeView(1, 1, 1, sceneContent());
  let debugPanel: DebugPanel | null = null;
  let started = false;
  let paused = false;
  let onScreen = true;
  let fpsFrames = 0;
  let fpsTime = performance.now();
  let fps = 0;

  const audioSettings: AudioSettings = {
    muted: saved?.audio.muted ?? AUDIO_DEFAULTS.muted,
    track: TRACK_CYCLE.includes(saved?.audio.track ?? '-') ? saved!.audio.track! : TRACK_CYCLE[0],
    musicVolume: saved?.audio.musicVolume ?? AUDIO_DEFAULTS.musicVolume,
    sfxVolume: saved?.audio.sfxVolume ?? AUDIO_DEFAULTS.sfxVolume,
  };
  const audio = createAudio();
  audio.setMuted(audioSettings.muted);
  audio.setTrack(audioSettings.track);
  audio.setMusicVolume(audioSettings.musicVolume);
  audio.setSfxVolume(audioSettings.sfxVolume);
  const mixer = new SfxMixer();
  let pendingSfx: SfxName[] = [];

  // ── Dialogs (menu modal, sound popover): one open at a time ──────────────

  const dialogs = new Dialogs(root, box);
  const menu = createMenu({ act, iconUrl });
  const sound = createSoundPanel(
    {
      toggleMute() {
        audioSettings.muted = !audioSettings.muted;
        audio.setMuted(audioSettings.muted);
        refreshAudioButtons();
        saveNow();
      },
      setVolume(key, value) {
        audioSettings[key] = value;
        if (key === 'musicVolume') audio.setMusicVolume(value);
        else audio.setSfxVolume(value);
      },
      commit: saveNow,
    },
    audioSettings,
  );
  autoButton.before(menu.el, sound.el);

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
    menu.refreshIcons();
    refreshAudioButtons();
    if (!loop.running) draw();
  }

  function iconUrl(def: SpriteDef): string {
    return sprites.frame(def, 0).toDataURL();
  }

  function resize(): void {
    // Inside the border: the canvas fills the padding box.
    const compact = box.clientWidth < COMPACT_WIDTH;
    view = computeView(
      box.clientWidth,
      box.clientHeight,
      window.devicePixelRatio || 1,
      sceneContent(compact),
      compact ? COMPACT_HUD_HEIGHT : HUD_HEIGHT,
      compact ? COMPACT_BOTTOM : 0,
    );
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
    if (dialogs.isOpen(menu.el)) menu.refresh(state);
    if (opts.debug) drawDebug();
  }

  const show = createShow();

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
    show(autoButton, state.autoAdvance ? 'AUTO ON' : 'AUTO OFF');
    autoButton.setAttribute('aria-pressed', String(state.autoAdvance));
  }

  function refreshUi(): void {
    refreshHud();
    if (dialogs.isOpen(menu.el)) menu.refresh(state);
  }

  function refreshAudioButtons(): void {
    const label = `Music: ${trackName(audioSettings.track)} (click to switch)`;
    musicButton.setAttribute('aria-label', label);
    show(musicButton, label, 'title');
    musicButton.querySelector('img')!.src = iconUrl(
      audioSettings.track ? icons.music : icons.musicOff,
    );
    const soundLabel = `Sound settings (${audioSettings.muted ? 'muted' : 'on'})`;
    soundButton.setAttribute('aria-label', soundLabel);
    show(soundButton, soundLabel, 'title');
    soundButton.querySelector('img')!.src = iconUrl(audioSettings.muted ? icons.sfxOff : icons.sfx);
    sound.refresh(audioSettings);
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
    debugPanel?.setStats(
      `v${__VERSION__} ${loop.running ? 'running' : 'paused'} fps ${fps} scale ${view.scale}\n` +
        `${d.phase} t${d.tick} hero ${d.heroHp} mob ${d.mob.hp}/${d.mob.maxHp} ` +
        `dmg ${heroDamage(state)} vs ${d.mob.damage}`,
    );
  }

  // ── Debugger (bottom-left, `debug` attribute or ?afkdebug) ───────────────

  function debugApply(data: unknown): string[] | null {
    const result = validateSaveData(data, TRACK_CYCLE);
    if (!result.ok) return result.errors;
    state = createState(result.progress);
    Object.assign(audioSettings, result.audio);
    audio.setMuted(audioSettings.muted);
    audio.setTrack(audioSettings.track);
    audio.setMusicVolume(audioSettings.musicVolume);
    audio.setSfxVolume(audioSettings.sfxVolume);
    refreshAudioButtons();
    writeSave(storage, opts.saveKey, toSaveData(state, audioSettings, __VERSION__));
    if (!started) startButton.textContent = `Continue · ${state.world}.${state.stage}`;
    refreshUi();
    if (!loop.running) draw();
    return null;
  }

  function debugReset(): void {
    try {
      storage?.removeItem(opts.saveKey);
    } catch {
      // storage blocked: nothing to clear
    }
    state = createState();
    if (!started) startButton.textContent = 'Start';
    saveNow(); // keeps the audio settings once the game is running
    refreshUi();
    if (!loop.running) draw();
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

  // ── Controls ─────────────────────────────────────────────────────────────

  box.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLElement>('[data-act]');
    switch (target?.dataset.act) {
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
      case 'sound':
        dialogs.toggle(sound.el, soundButton);
        return;
      case 'menu':
        if (dialogs.isOpen(menu.el)) {
          dialogs.close();
        } else {
          menu.refresh(state);
          dialogs.open(menu.el, menuButton, menu.focusTarget);
        }
        return;
      case 'auto':
        act((s) => setAutoAdvance(s, !s.autoAdvance));
        return;
    }
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

  if (opts.debug) {
    debugPanel = createDebugPanel(
      box,
      {
        read: () => toSaveData(state, audioSettings, __VERSION__),
        apply: debugApply,
        reset: debugReset,
      },
      TRACK_CYCLE,
    );
  }
  applyTheme();
  resize();

  return {
    setTheme(mode) {
      themeMode = mode;
      applyTheme();
    },
    destroy() {
      saveNow();
      dialogs.destroy();
      debugPanel?.destroy();
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
