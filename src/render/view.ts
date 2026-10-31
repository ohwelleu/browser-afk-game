export type View = {
  /** Canvas backing size in device pixels. */
  pxWidth: number;
  pxHeight: number;
  /** Whole-number device pixels per art pixel. */
  scale: number;
  /** Visible scene size in art pixels. */
  width: number;
  height: number;
  /** Device-pixel offset that pins the scene to the bottom edge. */
  offsetY: number;
};

/**
 * Picks the largest whole-number scale at which `content` (art px) fits the
 * canvas below a `topReserve` CSS-px band (the HUD).
 */
export function computeView(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  content: { width: number; height: number },
  topReserve = 0,
): View {
  const pxWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pxHeight = Math.max(1, Math.round(cssHeight * dpr));
  const availH = Math.max(1, pxHeight - Math.round(topReserve * dpr));
  const scale = Math.max(
    1,
    Math.min(Math.floor(availH / content.height), Math.floor(pxWidth / content.width)),
  );
  const height = Math.floor(pxHeight / scale);
  return {
    pxWidth,
    pxHeight,
    scale,
    width: Math.ceil(pxWidth / scale),
    height,
    offsetY: pxHeight - height * scale,
  };
}
