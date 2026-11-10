import { crowFlyBack, crowFlyOut, crowIcon, crowIdle, crowPeck, peckSpark } from './crow';
import type { Point, SpriteDef } from './types';
import { wolfAttack, wolfIcon, wolfIdle } from './wolf';

/**
 * Sprite sets of the companions. `CompanionDef.sprites` is a key of
 * `companionSprites`; the set's `kind` is how the scene moves it.
 */

export type FlyerAnimation = 'idle' | 'flyOut' | 'peck' | 'flyBack';
export type LungerAnimation = 'idle' | 'attack';
export type CompanionAnimation = FlyerAnimation | LungerAnimation;

/** Perches on the hero's hat, flies to the mob, strikes and flies back (the crow). */
export type FlyerSprites = {
  kind: 'flyer';
  animations: Record<FlyerAnimation, SpriteDef>;
  icon: SpriteDef;
  /** Frame of `animations.peck` where damage lands. */
  hitFrame: number;
  /** Beak tip on the hit frame, in companion frame pixels. */
  hitPoint: Point;
  /** Impact effect, centred on `hitPoint` from the hit frame on. */
  hitEffect: SpriteDef;
};

/** Stands behind the hero and lunges towards the mob (the wolf). */
export type LungerSprites = {
  kind: 'lunger';
  animations: Record<LungerAnimation, SpriteDef>;
  icon: SpriteDef;
  /** Frame of `animations.attack` where damage lands. */
  hitFrame: number;
  /** How far the sprite slides towards the mob at the hit frame, in art pixels. */
  lunge: number;
};

export type CompanionSprites = FlyerSprites | LungerSprites;

export const companionSprites = {
  crow: {
    kind: 'flyer',
    animations: { idle: crowIdle, flyOut: crowFlyOut, peck: crowPeck, flyBack: crowFlyBack },
    icon: crowIcon,
    hitFrame: 1,
    hitPoint: { x: 15, y: 10 },
    hitEffect: peckSpark,
  },
  wolf: {
    kind: 'lunger',
    animations: { idle: wolfIdle, attack: wolfAttack },
    icon: wolfIcon,
    hitFrame: 2,
    lunge: 6,
  },
} satisfies Record<string, CompanionSprites>;
