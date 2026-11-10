import { describe, expect, it } from 'vitest';
import { ITEM_SLOTS } from '../game/balance';
import * as S from './index';
import type { SpriteDef, WeaponDef } from './types';
import { validateAnchors, validateSprite, validateWeapon } from './validate';

const exported = Object.values(S as Record<string, unknown>);
const sprites = exported.filter(
  (v): v is SpriteDef => typeof v === 'object' && v !== null && 'frames' in v,
);
const weapons = exported.filter(
  (v): v is WeaponDef => typeof v === 'object' && v !== null && 'poses' in v,
);

describe('sprites', () => {
  it.each(sprites.map((s) => [s.name, s] as const))('%s has valid rows and chars', (_, s) => {
    expect(validateSprite(s)).toEqual([]);
  });

  it.each(weapons.map((w) => [w.name, w] as const))('%s poses are valid', (_, w) => {
    expect(validateWeapon(w)).toEqual([]);
  });

  it('weapons cover every tier in order', () => {
    expect(S.weapons.map((w) => w.tier)).toEqual(S.weapons.map((_, i) => i));
  });

  it('every hero animation has one weapon anchor per frame', () => {
    const hero = sprites.filter((s) => s.name.startsWith('hero-'));
    expect(hero.length).toBeGreaterThan(0);
    for (const s of hero) {
      expect(
        validateAnchors(s, S.heroWeaponAnchors[s.name.slice('hero-'.length) as S.HeroAnimation]),
      ).toEqual([]);
    }
  });

  it('slash arcs: one per tier, same size, frame map matches heroSlash', () => {
    expect(S.slashArcs).toHaveLength(S.weapons.length);
    const [first] = S.slashArcs;
    for (const arc of S.slashArcs) {
      expect([arc.width, arc.height, arc.frames.length]).toEqual([
        first.width,
        first.height,
        first.frames.length,
      ]);
    }
    expect(S.slashArcFrames).toHaveLength(S.heroSlash.frames.length);
    for (const f of S.slashArcFrames) {
      if (f !== null)
        (expect(f).toBeGreaterThanOrEqual(0), expect(f).toBeLessThan(first.frames.length));
    }
  });

  it('every weapon anchor sits in the hero hand (the bg cut-out)', () => {
    for (const [anim, list] of Object.entries(S.heroWeaponAnchors)) {
      const frames = S.heroAnimations[anim as S.HeroAnimation].frames;
      list.forEach((a, f) => {
        if (a) expect([anim, f, frames[f][a.y][a.x]]).toEqual([anim, f, 'o']);
      });
    }
  });

  it('swords are sized for the 32×64 hero and grow with the tier', () => {
    const lengths = S.weapons.map((w) => w.poses.fwd.sprite.width);
    for (const len of lengths) expect(len).toBeGreaterThanOrEqual(22);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
  });

  it('slash arcs stay above the ground', () => {
    expect(S.slashArcOffset.y + S.slashArcs[0].height).toBeLessThanOrEqual(S.heroSlash.height);
  });

  it('hero holds the weapon in front on every frame', () => {
    for (const list of Object.values(S.heroWeaponAnchors)) {
      for (const a of list) expect(a?.behind ?? false).toBe(false);
    }
  });

  it('crow: same canvas on every animation, hit frame and beak tip are drawn', () => {
    const c = S.companionSprites.crow;
    for (const a of Object.values(c.animations)) expect([a.width, a.height]).toEqual([16, 16]);
    expect(c.hitFrame).toBeGreaterThanOrEqual(0);
    expect(c.hitFrame).toBeLessThan(c.animations.peck.frames.length);
    const row = c.animations.peck.frames[c.hitFrame][c.hitPoint.y];
    expect(row?.[c.hitPoint.x] ?? '.').not.toBe('.');
  });

  it('wolf: 24×16 on every animation, 2–4 frames each, hit frame on the bite', () => {
    const w = S.companionSprites.wolf;
    for (const a of Object.values(w.animations)) {
      expect([a.width, a.height]).toEqual([24, 16]);
      expect(a.frames.length).toBeGreaterThanOrEqual(2);
      expect(a.frames.length).toBeLessThanOrEqual(4);
    }
    expect(w.hitFrame).toBeGreaterThanOrEqual(0);
    expect(w.hitFrame).toBeLessThan(w.animations.attack.frames.length);
    expect(w.lunge).toBeGreaterThan(0);
  });

  it('wolf: feet on the bottom row while standing, and no empty frames', () => {
    const idle = S.companionSprites.wolf.animations.idle;
    for (const frame of idle.frames) expect(frame[frame.length - 1]).toMatch(/#/);
    for (const a of Object.values(S.companionSprites.wolf.animations)) {
      for (const frame of a.frames) expect(frame.join('')).toMatch(/Y|#/);
    }
  });

  it('companions: every set has a shop icon the size of the other icons', () => {
    for (const [id, c] of Object.entries(S.companionSprites)) {
      expect([id, c.icon.width, c.icon.height]).toEqual([
        id,
        S.iconDamage.width,
        S.iconDamage.height,
      ]);
    }
  });

  it('crow fly-back is fly-out facing left', () => {
    const flip = (f: string[]) => f.map((r) => [...r].reverse().join(''));
    expect(S.crowFlyBack.frames).toEqual(S.crowFlyOut.frames.map(flip));
  });

  it('validator rejects broken sprites', () => {
    const bad: SpriteDef = { name: 'bad', width: 3, height: 2, frames: [['##', '#x#', '###']] };
    expect(validateSprite(bad)).toEqual([
      'bad: frame 0: 3 rows, expected 2',
      'bad: frame 0 row 0: 2 chars, expected 3',
      'bad: frame 0 row 1 col 1: bad char "x"',
    ]);
  });

  it('sprite names are unique', () => {
    const names = [
      ...sprites,
      ...weapons.flatMap((w) => Object.values(w.poses).map((p) => p.sprite)),
    ].map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('gear', () => {
  const frames = [...Object.values(S.itemFrames), S.itemSlotEmpty];

  it('every tier frame and the empty slot share one size', () => {
    for (const f of frames) expect([f.width, f.height]).toEqual([16, 16]);
  });

  it('icons fit inside the frame at the icon offset, with a gap to the border', () => {
    for (const icon of Object.values(S.itemIcons)) {
      expect(S.ITEM_ICON_OFFSET.x + icon.width).toBeLessThanOrEqual(16 - S.ITEM_ICON_OFFSET.x);
      expect(S.ITEM_ICON_OFFSET.y + icon.height).toBeLessThanOrEqual(16 - S.ITEM_ICON_OFFSET.y);
    }
  });

  it('has a 12×12 icon for every item slot', () => {
    expect(Object.keys(S.itemIcons).sort()).toEqual([...ITEM_SLOTS].sort());
    for (const icon of Object.values(S.itemIcons))
      expect([icon.width, icon.height]).toEqual([12, 12]);
  });

  it('only the S frame is animated', () => {
    expect(S.itemFrames.S.frames.length).toBeGreaterThan(1);
    for (const f of [S.itemFrames.C, S.itemFrames.B, S.itemFrames.A, S.itemSlotEmpty])
      expect(f.frames).toHaveLength(1);
  });
});

describe('HUD icon buttons', () => {
  /** Visible pixel extent of a sprite's first frame: [width, height]. */
  const extent = (def: SpriteDef): [number, number] => {
    const rows = def.frames[0];
    const xs = rows.flatMap((r) => [...r].flatMap((c, x) => (c === '.' ? [] : [x])));
    const ys = rows.flatMap((r, y) => ([...r].some((c) => c !== '.') ? [y] : []));
    return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
  };

  it('pause, play, sound and menu icons are about as big as the music icon', () => {
    const [mw, mh] = extent(S.icons.music);
    for (const def of [S.icons.pause, S.icons.play, S.icons.sfx, S.icons.sfxOff, S.icons.menu]) {
      const [w, h] = extent(def);
      expect(Math.abs(h - mh), def.name).toBeLessThanOrEqual(1);
      expect(Math.abs(w - mw), def.name).toBeLessThanOrEqual(3);
    }
  });
});
