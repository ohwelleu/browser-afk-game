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
  border: 3px solid var(--_fg);
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
  border: 3px solid var(--_fg);
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
.start { font-size: 16px; padding: 8px 20px; }

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
.bar { width: 132px; height: 16px; border: 3px solid var(--_fg); padding: 2px; }
.bar-fill { height: 100%; background: var(--_green); }
.bar-fill.low { background: var(--_red); }
.hud-center { text-align: center; font-weight: bold; white-space: nowrap; }
.boss { color: var(--_purple); }
.hud-right { display: flex; justify-content: flex-end; gap: 4px; }
.icon-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  display: grid;
  place-items: center;
  line-height: 1;
}

.toggle { min-width: 64px; padding: 4px 10px; font-weight: bold; }
.toggle[aria-pressed='true'] { color: var(--_bg); background: var(--_fg); }

/* Auto-advance toggle, always visible */
.auto-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  min-width: 0;
  padding: 6px 10px;
}

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
