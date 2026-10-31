/** Height of the scene in art pixels. Width follows the element's aspect ratio. */
export const SCENE_HEIGHT = 80;

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

export function computeView(cssWidth: number, cssHeight: number, dpr: number): View {
  const pxWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pxHeight = Math.max(1, Math.round(cssHeight * dpr));
  const scale = Math.max(1, Math.floor(pxHeight / SCENE_HEIGHT));
  return {
    pxWidth,
    pxHeight,
    scale,
    width: Math.ceil(pxWidth / scale),
    height: SCENE_HEIGHT,
    offsetY: pxHeight - SCENE_HEIGHT * scale,
  };
}
