export const STYLES = `
:host {
  display: block;
  position: relative;
  height: 160px;
  contain: content;
}
:host([hidden]) { display: none; }
.box {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--_bg);
  color: var(--_fg);
  font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.overlay[hidden] { display: none; }
.start {
  font: inherit;
  font-size: 14px;
  padding: 6px 16px;
  color: var(--_fg);
  background: var(--_bg);
  border: 2px solid var(--_fg);
  border-radius: 0;
  cursor: pointer;
}
.start:hover, .start:focus-visible {
  color: var(--_bg);
  background: var(--_fg);
  outline: none;
}
.debug {
  position: absolute;
  top: 4px;
  left: 4px;
  white-space: pre;
  pointer-events: none;
  opacity: 0.8;
}
.debug[hidden] { display: none; }
`;
