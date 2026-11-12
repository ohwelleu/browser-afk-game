import { afterEach, describe, expect, it } from 'vitest';
import { DUEL } from './balance';
import {
  GAME_SPEEDS,
  MOB_APPEAR_SPEEDS,
  mobAppearSpeed,
  scaleAppear,
  setMobAppearSpeed,
  speedLabel,
  validSpeed,
} from './debug-speed';
import { createState, newProgress, update } from './state';

afterEach(() => setMobAppearSpeed(1));

describe('scaleAppear', () => {
  it('is the real timing at ×1', () => {
    expect(scaleAppear(DUEL.intro, 1)).toBe(DUEL.intro);
    expect(scaleAppear(DUEL.shortIntro, 1)).toBe(DUEL.shortIntro);
  });

  it('divides the time by the multiplier', () => {
    expect(scaleAppear(2, 4)).toBe(0.5);
    expect(scaleAppear(2, 0.5)).toBe(4);
    expect(scaleAppear(2, 0.25)).toBe(8);
    expect(scaleAppear(2, 10)).toBe(0.2);
  });

  it('instant is 0 seconds', () => {
    expect(scaleAppear(DUEL.intro, Infinity)).toBe(0);
  });

  it('treats a bad multiplier as ×1', () => {
    expect(scaleAppear(2, 0)).toBe(2);
    expect(scaleAppear(2, -3)).toBe(2);
    expect(scaleAppear(2, NaN)).toBe(2);
  });
});

describe('options', () => {
  it('match the owner spec and include ×1 as default', () => {
    expect(GAME_SPEEDS).toEqual([0.5, 1, 2, 5, 10, 20]);
    expect(MOB_APPEAR_SPEEDS).toEqual([0.25, 0.5, 1, 2, 4, 10, Infinity]);
  });

  it('are labelled', () => {
    expect(speedLabel(2)).toBe('×2');
    expect(speedLabel(0.25)).toBe('×0.25');
    expect(speedLabel(Infinity)).toBe('instant');
    expect(validSpeed(Infinity)).toBe(Infinity);
  });
});

describe('mob appear speed in the duel', () => {
  const dt = 1 / 60;
  const run = (ticks: number) => {
    let s = createState(newProgress());
    for (let i = 0; i < ticks; i++) s = update(s, dt);
    return s;
  };

  it('defaults to ×1 and the full intro lasts DUEL.intro', () => {
    expect(mobAppearSpeed()).toBe(1);
    expect(createState(newProgress()).duel.introTicks).toBe(Math.round(DUEL.intro * 60));
  });

  it('shortens the intro at ×4 and makes it 0 ticks when instant', () => {
    setMobAppearSpeed(4);
    expect(createState(newProgress()).duel.introTicks).toBe(Math.round((DUEL.intro / 4) * 60));
    setMobAppearSpeed(Infinity);
    expect(createState(newProgress()).duel.introTicks).toBe(0);
    expect(run(1).duel.phase).toBe('fighting');
  });

  it('is back to the real timings after a reset', () => {
    setMobAppearSpeed(10);
    setMobAppearSpeed(1);
    expect(createState(newProgress()).duel.introTicks).toBe(Math.round(DUEL.intro * 60));
  });
});
