import { createAudio } from './audio';
import { createState, update, type GameState } from './game/state';
import { Loop } from './loop';
import { render } from './render/render';
import { SpriteCache } from './render/sprites';
import { computeView, type View } from './render/view';
import { readSavePreview } from './save';
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

/**
 * Wires one game instance into a shadow root: DOM, canvas sizing, theme,
 * loop and pause rules. Game logic itself lives in `game/`.
 */
export function createGame(root: ShadowRoot, host: HTMLElement, opts: GameOptions): GameHandle {
  root.innerHTML = `
    <style>${STYLES}</style>
    <div class="box" part="box">
      <canvas aria-hidden="true"></canvas>
      <div class="overlay"><button class="start" type="button">Start</button></div>
      <div class="debug" hidden></div>
    </div>`;
  const box = root.querySelector<HTMLDivElement>('.box')!;
  const canvas = root.querySelector('canvas')!;
  const overlay = root.querySelector<HTMLDivElement>('.overlay')!;
  const button = root.querySelector<HTMLButtonElement>('.start')!;
  const debugEl = root.querySelector<HTMLDivElement>('.debug')!;
  const ctx = canvas.getContext('2d')!;

  const save = readSavePreview(safeLocalStorage(), opts.saveKey);
  if (save) button.textContent = save.stage ? `Continue · ${save.stage}` : 'Continue';

  const colorScheme = matchMedia('(prefers-color-scheme: dark)');
  let themeMode = opts.theme;
  let palette: Palette = currentPalette();
  const sprites = new SpriteCache(palette);
  let state: GameState = createState();
  let view: View = computeView(1, 1, 1);
  let started = false;
  let onScreen = true;
  let fpsFrames = 0;
  let fpsTime = performance.now();
  let fps = 0;

  const audio = createAudio();
  const loop = new Loop((dt) => {
    state = update(state, dt);
  }, draw);

  function currentPalette(): Palette {
    const theme = resolveTheme(themeMode, document.documentElement.classList, colorScheme.matches);
    const style = getComputedStyle(host);
    return buildPalette(theme, (name) => style.getPropertyValue(name));
  }

  function applyTheme(): void {
    palette = currentPalette();
    sprites.setPalette(palette);
    box.style.setProperty('--_bg', palette.bg);
    box.style.setProperty('--_fg', palette.fg);
    if (!loop.running) draw();
  }

  function resize(): void {
    const rect = box.getBoundingClientRect();
    view = computeView(rect.width, rect.height, window.devicePixelRatio || 1);
    if (canvas.width !== view.pxWidth) canvas.width = view.pxWidth;
    if (canvas.height !== view.pxHeight) canvas.height = view.pxHeight;
    // Resizing clears the canvas, so repaint even when paused.
    draw();
  }

  function draw(): void {
    render(ctx, state, view, palette, sprites);
    if (opts.debug) drawDebug();
  }

  function drawDebug(): void {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsTime));
      fpsFrames = 0;
      fpsTime = now;
    }
    debugEl.textContent =
      `v${__VERSION__}  ${loop.running ? 'running' : 'paused'}\n` +
      `fps ${fps}  ticks ${state.ticks}  t ${state.time.toFixed(1)}s\n` +
      `scale ${view.scale}  scene ${view.width}×${view.height}`;
  }

  /** Runs only after Start, while on screen and while the tab is visible. */
  function syncRunning(): void {
    const shouldRun = started && onScreen && !document.hidden;
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

  button.addEventListener('click', () => {
    if (started) return;
    started = true;
    overlay.hidden = true;
    void audio.start();
    syncRunning();
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  window.addEventListener('resize', resize); // catches devicePixelRatio changes (zoom)

  const intersectionObserver = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    syncRunning();
  });
  intersectionObserver.observe(host);

  document.addEventListener('visibilitychange', syncRunning);

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
      loop.stop();
      audio.pause();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      htmlObserver.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncRunning);
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
