import { describe, expect, it } from 'vitest';
import { windup } from '../game/attacks';
import { COMPANION_IDS, COMPANIONS, type CompanionId } from '../game/balance';
import type { Item } from '../game/items';
import { createState, newProgress, secToTicks, type GameState } from '../game/state';
import { companionSprites } from '../sprites';
import { DEFAULT_PALETTES } from '../theme';
import type { SpriteCache } from './sprites';
import {
  clickBurst,
  companionPose,
  layout,
  RAIN_ZONE_W,
  rainArea,
  SceneRenderer,
  sceneContent,
} from './scene';
import { computeView } from './view';

const { crow, wolf } = companionSprites;
const owning = (levels: Partial<Record<CompanionId, number>>): GameState =>
  createState({ ...newProgress(), companions: { crow: 0, wolf: 0, ...levels } });
/** `id` attacked at duel time 0 and it is now `sec` seconds later. */
const attackAt = (s: GameState, id: CompanionId, sec: number): GameState => ({
  ...s,
  duel: {
    ...s.duel,
    companionAttackTick: { ...s.duel.companionAttackTick, [id]: 0 },
    tick: secToTicks(sec),
  },
});

const VIEWS = [
  ['desktop', computeView(1280, 720, 1, sceneContent())],
  ['mobile', computeView(360, 640, 3, sceneContent(true), 40, 60)],
] as const;

describe.each(VIEWS)('crow pose (%s)', (_, view) => {
  const s = owning({ crow: 1 });
  const l = layout(s, view);
  const pose = (st: GameState) => companionPose(st, l, COMPANIONS.crow)!;

  it('perches on the hero, inside the scene', () => {
    const p = pose(s);
    expect(p.anim).toBe('idle');
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    // Overlaps the hero box from above, feet on the hat.
    expect(p.x).toBeGreaterThanOrEqual(l.heroX);
    expect(p.y + crow.animations.idle.height).toBeGreaterThan(l.heroY);
    expect(p.y + crow.animations.idle.height).toBeLessThan(l.heroY + l.hero.height / 3);
  });

  it('shows the peck hit frame at the mob when damage lands, then flies back', () => {
    const out = windup(COMPANIONS.crow.attack);
    expect(pose(attackAt(s, 'crow', 0.01)).anim).toBe('flyOut');
    const hit = pose(attackAt(s, 'crow', out + 0.01));
    expect(hit).toMatchObject({ anim: 'peck', frame: crow.hitFrame });
    expect(hit.x + crow.hitPoint.x).toBe(l.mobX);
    expect(hit.effect).not.toBeNull();
    expect(pose(attackAt(s, 'crow', out + 0.15)).anim).toBe('flyBack');
    expect(pose(attackAt(s, 'crow', 2))).toMatchObject({ anim: 'idle', effect: null });
  });

  it('is not moved by the wolf attacking', () => {
    const both = owning({ crow: 1, wolf: 1 });
    expect(pose(attackAt(both, 'wolf', 0.1)).anim).toBe('idle');
  });
});

describe.each(VIEWS)('wolf pose (%s)', (_, view) => {
  const s = owning({ wolf: 1 });
  const l = layout(s, view);
  const pose = (st: GameState) => companionPose(st, l, COMPANIONS.wolf)!;
  const w = wolf.animations.idle;

  it('stands behind the hero: to its left, tucked a little under it, feet on the ground', () => {
    const p = pose(s);
    expect(p.anim).toBe('idle');
    expect(p.x).toBeGreaterThanOrEqual(0); // fully on screen
    expect(p.x).toBeLessThan(l.heroX);
    expect(p.x + w.width).toBeGreaterThan(l.heroX); // the hero covers its right end
    expect(p.x + w.width).toBeLessThan(l.heroX + l.hero.width / 2);
    expect(p.y + w.height).toBe(l.groundY);
  });

  it('the hero is clear of the mob, with or without the wolf', () => {
    expect(l.heroX + l.hero.width).toBeLessThan(l.mobX);
    expect(layout(owning({}), view).heroX).toBe(l.heroX); // buying the wolf moves nothing
  });

  it('lunges towards the mob until the hit frame, then back, and the damage lands on the bite', () => {
    const out = windup(COMPANIONS.wolf.attack);
    const total = wolf.animations.attack.frames.length / wolf.animations.attack.fps!;
    const rest = pose(s).x;
    const crouch = pose(attackAt(s, 'wolf', 0.001));
    expect(crouch).toMatchObject({ anim: 'attack', frame: 0 });
    const bite = pose(attackAt(s, 'wolf', out + 0.001));
    expect(bite).toMatchObject({ anim: 'attack', frame: wolf.hitFrame });
    expect(bite.x - rest).toBe(wolf.lunge);
    expect(bite.x).toBeGreaterThan(crouch.x);
    expect(pose(attackAt(s, 'wolf', out + (total - out) / 2)).x).toBeGreaterThan(rest);
    expect(pose(attackAt(s, 'wolf', total + 0.01))).toMatchObject({ anim: 'idle', x: rest });
    // It never jumps past the hero.
    expect(bite.x + w.width).toBeLessThan(l.heroX + l.hero.width);
  });
});

it('has no pose for a companion that is not bought', () => {
  const s = createState();
  const l = layout(s, computeView(800, 450, 1, sceneContent()));
  for (const id of COMPANION_IDS) expect(companionPose(s, l, COMPANIONS[id])).toBeNull();
  const crowOnly = owning({ crow: 1 });
  expect(companionPose(crowOnly, l, COMPANIONS.wolf)).toBeNull();
});

it('every companion points at a sprite set that matches its position', () => {
  for (const id of COMPANION_IDS) {
    const def = COMPANIONS[id];
    const set = companionSprites[def.sprites as keyof typeof companionSprites];
    expect(set).toBeDefined();
    expect(set.kind).toBe(def.position === 'hat' ? 'flyer' : 'lunger');
  }
});

it('click burst grows and thins out', () => {
  const r = (t: number) => Math.max(...clickBurst(t).map((d) => Math.hypot(d.x, d.y)));
  expect(clickBurst(0)).toHaveLength(8);
  expect(clickBurst(0.9)).toHaveLength(4);
  expect(r(0.9)).toBeGreaterThan(r(0));
});

describe.each(VIEWS)('item rain zone (%s)', (_, view) => {
  const l = layout(owning({}), view);
  const area = rainArea(l, view.width);

  it('is RAIN_ZONE_W art px centred on the hero, inside the scene and clear of the mob', () => {
    expect(area.right - area.left).toBe(RAIN_ZONE_W);
    const centre = (area.left + area.right) / 2;
    expect(Math.abs(centre - (l.heroX + l.hero.width / 2))).toBeLessThanOrEqual(0.5);
    expect(area.left).toBeGreaterThanOrEqual(0);
    expect(area.right).toBeLessThanOrEqual(view.width);
    expect(area.right).toBeLessThan(l.mobX);
  });

  it('runs from the top of the hero (below the HUD) down to the ground', () => {
    expect(area.top).toBe(l.heroY);
    expect(area.top).toBeGreaterThanOrEqual(0);
    expect(area.bottom).toBe(l.groundY);
  });

  it('is cut to a scene narrower than the zone', () => {
    const narrow = rainArea({ ...l, heroX: 2 }, 30);
    expect(narrow.left).toBe(0);
    expect(narrow.right).toBe(30);
  });
});

describe('item rain in the scene (the real draw path)', () => {
  const view = computeView(1280, 720, 1, sceneContent());
  const palette = DEFAULT_PALETTES.light;
  // Draw calls other than the rain's fillRects don't matter here: swallow them.
  const noop: unknown = new Proxy(() => noop, { get: () => noop, apply: () => noop });
  const sprites = noop as SpriteCache;
  const withS = (ticks: number): GameState => {
    const s = createState({ ...newProgress() });
    const ring: Item = { id: 1, slot: 'ring', tier: 'SS', world: 1, stage: 1, stats: {} };
    return { ...s, ticks, items: { ...s.items, ring } };
  };
  /** Colours drawn at 1 px width (the rain) at tick `ticks`, per x, top to bottom. */
  function rainRects(r: SceneRenderer, ticks: number) {
    const rects: { fill: string; x: number; y: number }[] = [];
    const ctx = new Proxy({ fillStyle: '' } as Record<string, unknown>, {
      get(t, k) {
        if (k === 'fillRect')
          return (x: number, y: number, w: number) => {
            if (w === 1) rects.push({ fill: String(t.fillStyle), x, y });
          };
        return k in t ? t[k as string] : noop;
      },
      set(t, k, v) {
        t[k as string] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    r.draw(ctx, withS(ticks), view, palette, sprites);
    return JSON.stringify(rects);
  }

  it('moves and changes colour from frame to frame while the game runs', () => {
    const r = new SceneRenderer(() => false);
    const frames = new Set<string>();
    for (let t = 0; t < 120; t += 6) frames.add(rainRects(r, t));
    expect(frames.size).toBe(20); // every sampled frame is different
  });

  it('reads the Animations setting live: still while Reduced, moving again after On', () => {
    let reduced = false;
    const r = new SceneRenderer(() => reduced);
    rainRects(r, 0);
    const moving = rainRects(r, 30) !== rainRects(r, 60);
    reduced = true;
    const a = rainRects(r, 90);
    const b = rainRects(r, 150);
    reduced = false;
    const c = rainRects(r, 180);
    const d = rainRects(r, 240);
    expect(moving).toBe(true);
    expect(a).toBe(b);
    expect(c).not.toBe(d);
  });
});
