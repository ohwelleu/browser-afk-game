import { AfkGameElement } from './element';
import { createGame, type GameHandle } from './game';
import { resolveOptions, type MountOptions } from './options';
import { loadFont } from './ui/font';

export type { MountOptions } from './options';
export type { ThemeMode } from './theme';
export { AfkGameElement };

export const version: string = __VERSION__;

/**
 * Mounts a game inside `el`, in its own shadow root so page CSS can't leak
 * in. Size the game by sizing `el`.
 */
export function mount(el: HTMLElement, opts: MountOptions = {}): { destroy(): void } {
  const host = document.createElement('div');
  host.style.cssText = 'display:block;width:100%;height:100%;';
  el.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  let game: GameHandle | null = null;
  let destroyed = false;
  // Wait for the pixel font so canvas text is drawn with it from frame one.
  void loadFont().then(() => {
    if (!destroyed) game = createGame(root, host, resolveOptions(opts, location.search));
  });
  return {
    destroy() {
      destroyed = true;
      game?.destroy();
      host.remove();
    },
  };
}

if (typeof customElements !== 'undefined' && !customElements.get('afk-game')) {
  customElements.define('afk-game', AfkGameElement);
}
