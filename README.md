# browser-afk-game

A tiny idle (AFK) pixel-art game you can drop into any web page with one
script tag and one HTML element.

A hero stands on the left and swings his weapon at mobs walking in from the
right. Mobs drop coins; coins buy new weapons and upgrades. The hero
auto-advances through stages and bosses on his own.

> Status: planning (`0.1.0`). See [docs/PLAN.md](docs/PLAN.md) and
> [CHANGELOG.md](CHANGELOG.md).

## Embed

```html
<!-- in <head> -->
<script src="https://ohwelleu.github.io/browser-afk-game/afk-game.js" defer></script>

<!-- anywhere in the page -->
<afk-game></afk-game>
```

On `ohwelleu.github.io` itself the path can be relative: `/browser-afk-game/afk-game.js`.

### Attributes

| Attribute  | Default      | Meaning                                     |
| ---------- | ------------ | ------------------------------------------- |
| `save-key` | `afk-game`   | `localStorage` key for the save             |
| `theme`    | `auto`       | `dark`, `light` or `auto`                   |
| `debug`    | _(off)_      | Show the debug panel (also `?afkdebug` URL) |

### Theming

Set `theme="dark" | "light" | "auto"` (default `auto`: follows the host's
`html.dark` class, then `prefers-color-scheme`). Every colour can be
overridden with CSS custom properties:

```css
afk-game {
  --afk-bg: #1f1f1f;
  --afk-fg: #ece9e2;
  --afk-orange: #ff7a1a; /* also --afk-yellow, -red, -purple, -green, -blue, -pink */
}
```

### JS API

```js
import { mount } from "./afk-game.js";

const game = mount(element, { saveKey: "afk-game", debug: false });
game.destroy();
```

## Docs

- [docs/PLAN.md](docs/PLAN.md): v1 scope, mechanics, numbers, milestones
- [docs/ROADMAP.md](docs/ROADMAP.md): features planned for later
- [docs/DECISIONS.md](docs/DECISIONS.md): why things are the way they are
- [CHANGELOG.md](CHANGELOG.md): what changed in each version
