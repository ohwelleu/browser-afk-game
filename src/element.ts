import { createGame, type GameHandle } from './game';
import { resolveOptions } from './options';
import { parseThemeMode } from './theme';

/** `<afk-game save-key="…" theme="dark|light|auto" debug>` */
export class AfkGameElement extends HTMLElement {
  static observedAttributes = ['save-key', 'theme', 'debug'];

  private game: GameHandle | null = null;

  connectedCallback(): void {
    this.mountGame();
  }

  disconnectedCallback(): void {
    this.game?.destroy();
    this.game = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.game || oldValue === newValue) return;
    if (name === 'theme') {
      this.game.setTheme(parseThemeMode(newValue));
    } else {
      // save-key / debug change the whole instance; rebuild it.
      this.game.destroy();
      this.game = null;
      this.mountGame();
    }
  }

  private mountGame(): void {
    if (this.game) return;
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    const opts = resolveOptions(
      {
        saveKey: this.getAttribute('save-key') ?? undefined,
        theme: this.getAttribute('theme') ?? undefined,
        debug: this.hasAttribute('debug'),
      },
      location.search,
    );
    this.game = createGame(root, this, opts);
  }
}
