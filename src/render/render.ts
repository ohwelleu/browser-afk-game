import type { GameState } from '../game/state';
import type { Palette } from '../theme';
import { PLACEHOLDER_HERO, PLACEHOLDER_MUSHROOM } from './placeholder-sprites';
import { frameAt, type SpriteCache } from './sprites';
import type { View } from './view';

/** Art-pixel rows below the ground line. */
const GROUND = 6;

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  palette: Palette,
  sprites: SpriteCache,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, view.pxWidth, view.pxHeight);

  ctx.setTransform(view.scale, 0, 0, view.scale, 0, view.offsetY);
  const groundY = view.height - GROUND;
  ctx.fillStyle = palette.fg;
  ctx.fillRect(0, groundY, view.width, 1);

  const hero = PLACEHOLDER_HERO;
  ctx.drawImage(sprites.frame(hero, frameAt(hero, state.time)), 8, groundY - hero.height);

  const mob = PLACEHOLDER_MUSHROOM;
  const mobX = Math.max(48, view.width - mob.width - 16);
  ctx.drawImage(sprites.frame(mob, frameAt(mob, state.time)), mobX, groundY - mob.height);
}
