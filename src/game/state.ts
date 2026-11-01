/**
 * Pure game logic. No DOM, canvas, audio or timers in here: `update` takes a
 * state and a time step and returns the next state. Actions (buy, equip, …)
 * are pure too. Each returned state carries the `events` it produced
 * (sounds, damage numbers, save triggers) for the caller to present.
 */
import type { SfxName } from '../audio/types';
import { TICK_RATE } from '../loop';
import { weaponAttack, windup } from './attacks';
import {
  DUEL,
  HERO_MAX_HP,
  isBoss,
  MOB_KINDS,
  mobCoins,
  mobDamage,
  mobHp,
  mobKind,
  safeInt,
  stageLevel,
  STAGES_PER_WORLD,
  upgradeCost,
  weaponDamage,
  WEAPONS,
  type MobKind,
} from './balance';

export type Phase = 'intro' | 'fighting' | 'mobDying' | 'heroDying' | 'transition';

export type Mob = { kind: MobKind; hp: number; maxHp: number; damage: number; coins: number };

/** One duel. All `*Tick` fields count ticks since the duel started. */
export type Duel = {
  phase: Phase;
  tick: number;
  phaseTick: number;
  /** Length of this duel's intro: full on new stages, a short beat otherwise. */
  introTicks: number;
  outcome: 'win' | 'loss' | null;
  heroHp: number;
  mob: Mob;
  heroNextHit: number;
  heroSwung: boolean;
  mobNextHit: number;
  mobLunged: boolean;
  /** Last time each animation trigger fired (null = never this duel). */
  heroAttackTick: number | null;
  heroHurtTick: number | null;
  mobAttackTick: number | null;
  mobHurtTick: number | null;
};

export type GameEvent =
  | { type: 'sfx'; name: SfxName }
  | { type: 'damage'; target: 'hero' | 'mob'; amount: number }
  | { type: 'coins'; amount: number }
  /** Stage changed or a purchase happened: worth saving now. */
  | { type: 'save' };

export type GameState = {
  ticks: number;
  world: number;
  stage: number;
  /** Highest stage reached, as `stageLevel` (1.1 → 1). Entering a higher one plays the full intro. */
  best: number;
  autoAdvance: boolean;
  coins: number;
  /** Level per weapon tier; 0 = not owned. The stick is always owned. */
  weaponLevels: number[];
  equipped: number;
  kills: number;
  deaths: number;
  duel: Duel;
  events: GameEvent[];
};

export type Progress = Pick<
  GameState,
  | 'world'
  | 'stage'
  | 'best'
  | 'autoAdvance'
  | 'coins'
  | 'weaponLevels'
  | 'equipped'
  | 'kills'
  | 'deaths'
>;

export const secToTicks = (s: number): number => Math.round(s * TICK_RATE);

export function newProgress(): Progress {
  return {
    world: 1,
    stage: 1,
    best: 1,
    autoAdvance: true,
    coins: 0,
    weaponLevels: WEAPONS.map((_, i) => (i === 0 ? 1 : 0)),
    equipped: 0,
    kills: 0,
    deaths: 0,
  };
}

export function createState(progress: Progress = newProgress()): GameState {
  return {
    ticks: 0,
    ...progress,
    best: Math.max(progress.best, stageLevel(progress.world, progress.stage)),
    weaponLevels: [...progress.weaponLevels],
    // The first duel after Start/Continue always gets the full intro.
    duel: newDuel(progress.world, progress.stage, true),
    events: [],
  };
}

export function newDuel(world: number, stage: number, fullIntro: boolean): Duel {
  const hp = mobHp(world, stage);
  const introTicks = secToTicks(fullIntro ? DUEL.intro : DUEL.shortIntro);
  return {
    phase: 'intro',
    tick: 0,
    phaseTick: 0,
    introTicks,
    outcome: null,
    heroHp: HERO_MAX_HP,
    mob: {
      kind: mobKind(stage),
      hp,
      maxHp: hp,
      damage: mobDamage(world, stage),
      coins: mobCoins(world, stage),
    },
    heroNextHit: introTicks,
    heroSwung: false,
    mobNextHit: introTicks + secToTicks(DUEL.mobOffset),
    mobLunged: false,
    heroAttackTick: null,
    heroHurtTick: null,
    mobAttackTick: null,
    mobHurtTick: null,
  };
}

/** Current hero damage per hit with the equipped weapon. */
export function heroDamage(s: Pick<GameState, 'equipped' | 'weaponLevels'>): number {
  const attack = weaponAttack(s.equipped);
  return safeInt(weaponDamage(s.equipped, s.weaponLevels[s.equipped] ?? 0) * attack.damageMult);
}

/** Advances `dt` seconds in whole fixed ticks (the loop always passes one tick). */
export function update(state: GameState, dt: number): GameState {
  const n = Math.max(1, Math.round(dt * TICK_RATE));
  const s = draft(state);
  for (let i = 0; i < n; i++) step(s);
  return s;
}

/** Shallow copy of everything `step` mutates, with a fresh event list. */
function draft(state: GameState): GameState {
  return {
    ...state,
    weaponLevels: [...state.weaponLevels],
    duel: { ...state.duel, mob: { ...state.duel.mob } },
    events: [],
  };
}

function step(s: GameState): void {
  s.ticks++;
  const d = s.duel;
  d.tick++;
  const t = d.tick;
  const inPhase = t - d.phaseTick;

  switch (d.phase) {
    case 'intro':
      if (t >= d.introTicks) setPhase(d, 'fighting');
      combat(s);
      return;
    case 'fighting':
      combat(s);
      return;
    case 'mobDying':
      if (inPhase >= secToTicks(DUEL.mobDying)) {
        setPhase(d, 'transition');
        if (s.autoAdvance) {
          advanceStage(s);
          s.events.push({ type: 'sfx', name: 'stageClear' });
        }
        s.events.push({ type: 'save' });
      }
      return;
    case 'heroDying':
      if (inPhase >= secToTicks(DUEL.heroDying)) {
        setPhase(d, 'transition');
        rollbackStage(s);
        s.autoAdvance = false;
        s.events.push({ type: 'save' });
      }
      return;
    case 'transition':
      if (inPhase >= secToTicks(DUEL.transition)) {
        const level = stageLevel(s.world, s.stage);
        const isNew = level > s.best;
        s.best = Math.max(s.best, level);
        s.duel = newDuel(s.world, s.stage, isNew);
        if (isBoss(s.stage)) s.events.push({ type: 'sfx', name: 'bossAppear' });
      }
      return;
  }
}

function setPhase(d: Duel, phase: Phase): void {
  d.phase = phase;
  d.phaseTick = d.tick;
}

/**
 * One tick of fighting. The hero acts first, so if both hits land on the
 * same tick the mob is already dead and can't hit back (hero wins the
 * double KO). Dead sides never act: the phase changes right away.
 */
function combat(s: GameState): void {
  const d = s.duel;
  const t = d.tick;
  const attack = weaponAttack(s.equipped);
  const mobKindDef = MOB_KINDS[d.mob.kind];

  if (!d.heroSwung && t >= d.heroNextHit - secToTicks(windup(attack))) {
    d.heroSwung = true;
    d.heroAttackTick = t;
    s.events.push({ type: 'sfx', name: 'swing' });
  }
  if (t >= d.heroNextHit) {
    const dmg = heroDamage(s);
    d.mob.hp = Math.max(0, safeInt(d.mob.hp - dmg));
    d.mobHurtTick = t;
    d.heroNextHit += Math.max(1, secToTicks(attack.interval));
    d.heroSwung = false;
    s.events.push({ type: 'damage', target: 'mob', amount: dmg }, { type: 'sfx', name: 'hit' });
  }
  if (d.mob.hp <= 0) {
    setPhase(d, 'mobDying');
    d.outcome = 'win';
    s.coins = safeInt(s.coins + d.mob.coins);
    s.kills++;
    s.events.push(
      { type: 'sfx', name: 'mobDeath' },
      { type: 'sfx', name: 'coin' },
      { type: 'coins', amount: d.mob.coins },
    );
    return;
  }

  if (!d.mobLunged && t >= d.mobNextHit - secToTicks(mobKindDef.windup)) {
    d.mobLunged = true;
    d.mobAttackTick = t;
  }
  if (t >= d.mobNextHit) {
    d.heroHp = Math.max(0, safeInt(d.heroHp - d.mob.damage));
    d.heroHurtTick = t;
    d.mobNextHit += Math.max(1, secToTicks(mobKindDef.interval));
    d.mobLunged = false;
    s.events.push(
      { type: 'damage', target: 'hero', amount: d.mob.damage },
      { type: 'sfx', name: 'hit' },
    );
  }
  if (d.heroHp <= 0) {
    setPhase(d, 'heroDying');
    d.outcome = 'loss';
    s.deaths++;
    s.events.push({ type: 'sfx', name: 'heroDeath' });
  }
}

function advanceStage(s: GameState): void {
  if (s.stage >= STAGES_PER_WORLD) {
    s.world++;
    s.stage = 1;
  } else {
    s.stage++;
  }
}

/** One stage back: 2.1 → 1.6, 1.1 stays 1.1. */
function rollbackStage(s: GameState): void {
  if (s.stage > 1) s.stage--;
  else if (s.world > 1) {
    s.world--;
    s.stage = STAGES_PER_WORLD;
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
// Each returns the same state object when the action isn't allowed, so the
// caller can tell nothing happened (and a double click can't double-buy).

export function canUpgrade(s: GameState): boolean {
  const level = s.weaponLevels[s.equipped] ?? 0;
  return level >= 1 && s.coins >= upgradeCost(s.equipped, level);
}

export function buyUpgrade(s: GameState): GameState {
  if (!canUpgrade(s)) return s;
  const level = s.weaponLevels[s.equipped];
  const next = draft(s);
  next.coins = safeInt(s.coins - upgradeCost(s.equipped, level));
  next.weaponLevels[s.equipped] = level + 1;
  next.events.push({ type: 'sfx', name: 'purchase' }, { type: 'save' });
  return next;
}

/** Tier of the next weapon in the shop, or null when all are owned. */
export function nextWeapon(s: Pick<GameState, 'weaponLevels'>): number | null {
  const i = s.weaponLevels.findIndex((lvl) => lvl < 1);
  return i < 0 ? null : i;
}

export function canBuyWeapon(s: GameState): boolean {
  const tier = nextWeapon(s);
  return tier !== null && s.coins >= WEAPONS[tier].price;
}

export function buyWeapon(s: GameState): GameState {
  const tier = nextWeapon(s);
  if (tier === null || !canBuyWeapon(s)) return s;
  const next = draft(s);
  next.coins = safeInt(s.coins - WEAPONS[tier].price);
  next.weaponLevels[tier] = 1;
  // Auto-equip unless the current weapon (maybe well upgraded) hits harder.
  if (heroDamage({ equipped: tier, weaponLevels: next.weaponLevels }) >= heroDamage(next)) {
    next.equipped = tier;
  }
  next.events.push({ type: 'sfx', name: 'purchase' }, { type: 'save' });
  return next;
}

export function equip(s: GameState, tier: number): GameState {
  if (tier === s.equipped || !((s.weaponLevels[tier] ?? 0) >= 1)) return s;
  const next = draft(s);
  next.equipped = tier;
  next.events.push({ type: 'save' });
  return next;
}

export function setAutoAdvance(s: GameState, on: boolean): GameState {
  if (s.autoAdvance === on) return s;
  const next = draft(s);
  next.autoAdvance = on;
  next.events.push({ type: 'save' });
  return next;
}
