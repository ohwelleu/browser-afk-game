import { describe, expect, it } from 'vitest';
import { windup } from '../game/attacks';
import { COMPANIONS } from '../game/balance';
import { createState, newProgress, secToTicks, type GameState } from '../game/state';
import { companionSprites } from '../sprites';
import { clickBurst, companionPose, layout, sceneContent } from './scene';
import { computeView } from './view';

const crow = companionSprites.crow;
const withCrow = (): GameState =>
  createState({
    ...newProgress(),
    companion: { id: 'crow', dmgLevel: 1, autoUnlocked: false, speedLevel: 1 },
  });
const attackAt = (s: GameState, sec: number): GameState => ({
  ...s,
  duel: { ...s.duel, companionAttackTick: 0, tick: secToTicks(sec) },
});

describe.each([
  ['desktop', computeView(1280, 720, 1, sceneContent())],
  ['mobile', computeView(360, 640, 3, sceneContent(true), 40, 60)],
])('companion pose (%s)', (_, view) => {
  const s = withCrow();
  const l = layout(s, view);

  it('perches on the hero, inside the scene', () => {
    const p = companionPose(s, l)!;
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
    expect(companionPose(attackAt(s, 0.01), l)!.anim).toBe('flyOut');
    const hit = companionPose(attackAt(s, out + 0.01), l)!;
    expect(hit).toMatchObject({ anim: 'peck', frame: crow.hitFrame });
    expect(hit.x + crow.hitPoint.x).toBe(l.mobX);
    expect(hit.effect).not.toBeNull();
    expect(companionPose(attackAt(s, out + 0.15), l)!.anim).toBe('flyBack');
    expect(companionPose(attackAt(s, 2), l)).toMatchObject({ anim: 'idle', effect: null });
  });
});

it('has no pose without a companion', () => {
  const s = createState();
  expect(companionPose(s, layout(s, computeView(800, 450, 1, sceneContent())))).toBeNull();
});

it('click burst grows and thins out', () => {
  const r = (t: number) => Math.max(...clickBurst(t).map((d) => Math.hypot(d.x, d.y)));
  expect(clickBurst(0)).toHaveLength(8);
  expect(clickBurst(0.9)).toHaveLength(4);
  expect(r(0.9)).toBeGreaterThan(r(0));
});
