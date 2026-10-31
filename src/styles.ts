export const STYLES = `
:host {
  display: block;
  position: relative;
  height: 546px;
  contain: content;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
.box {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--_bg);
  color: var(--_fg);
  font: 14px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
button {
  font: inherit;
  color: var(--_fg);
  background: var(--_bg);
  border: 1px solid var(--_fg);
  border-radius: 0;
  cursor: pointer;
}
button:hover:not(:disabled), button:focus-visible {
  color: var(--_bg);
  background: var(--_fg);
  outline: none;
}
button:hover:not(:disabled) img, button:focus-visible img { filter: invert(1); }
button:disabled { opacity: 0.4; cursor: default; }
img { image-rendering: pixelated; display: block; }

/* Start overlay */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.overlay[hidden] { display: none; }
.start { font-size: 16px; padding: 8px 20px; border-width: 2px; }

/* HUD */
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 8px;
  padding: 10px 12px;
  z-index: 1;
}
.hud-left { display: grid; gap: 4px; }
.hp, .coins { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.hp-icon { color: var(--_red); }
.bar { width: 120px; height: 10px; border: 1px solid var(--_fg); padding: 1px; }
.bar-fill { height: 100%; background: var(--_green); }
.bar-fill.low { background: var(--_red); }
.hud-center { text-align: center; font-weight: bold; white-space: nowrap; }
.boss { color: var(--_purple); }
.hud-right { display: flex; justify-content: flex-end; gap: 4px; }
.icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
  line-height: 1;
}

/* Modal */
.modal {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: color-mix(in srgb, var(--_bg) 60%, transparent);
}
.modal[hidden] { display: none; }
.panel {
  position: relative;
  width: min(560px, 100%);
  max-height: 100%;
  overflow: auto;
  background: var(--_bg);
  border: 1px solid var(--_fg);
  padding: 14px 16px;
}
.panel h2 { margin: 0 40px 8px 0; font-size: 16px; }
.panel h3 { margin: 14px 0 6px; font-size: 14px; border-bottom: 1px solid var(--_fg); }
.panel p { margin: 4px 0; }
.close { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; padding: 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0; }
.row button { padding: 3px 10px; white-space: nowrap; }
.inv { list-style: none; margin: 0; padding: 0; }
.muted { opacity: 0.6; }
.coin { color: var(--_orange); }

.debug {
  position: absolute;
  left: 12px;
  bottom: 4px;
  white-space: pre;
  pointer-events: none;
  font-size: 11px;
  opacity: 0.8;
  z-index: 1;
}
.debug[hidden] { display: none; }
`;
