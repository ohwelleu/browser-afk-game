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
  companionAutoInterval,
  companionDamage,
  companionDmgCost,
  companionMaxSpeedLevel,
  companionSpeedCost,
  COMPANIONS,
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
  type CompanionDef,
  type CompanionId,
  type MobKind,
} from './balance';
import { gearTotals, mobHitDamage, newGear, onKill, type Gear, type Item } from './items';

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
  /** Duel ticks when the companion's pecks in flight land. Dropped with the duel. */
  companionPecks: number[];
  /** Duel tick the last companion attack started (fly-out animation). */
  companionAttackTick: number | null;
};

/** The equipped companion (one slot). Saved as is. */
export type Companion = {
  id: CompanionId;
  dmgLevel: number;
  autoUnlocked: boolean;
  speedLevel: number;
};

export type GameEvent =
  | { type: 'sfx'; name: SfxName }
  | { type: 'damage'; target: 'hero' | 'mob'; amount: number; source?: 'companion' }
  | { type: 'coins'; amount: number }
  /** An item dropped; `soldFor` > 0 when the bag was full and it was sold at once. */
  | { type: 'item'; item: Item; soldFor: number }
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
  /** Highest `heroDps` ever reached (local stat; the future ranking value). */
  maxDps: number;
  /** Ring, pendant, bag and the drop RNG (game/items.ts). */
  items: Gear;
  companion: Companion | null;
  /** `ticks` of the last click peck, for the click cooldown (not saved). */
  companionClickTick: number | null;
  /** Fighting ticks since the last auto peck (not saved). */
  companionAutoCharge: number;
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
  | 'maxDps'
  | 'items'
  | 'companion'
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
    maxDps: 0,
    items: newGear(),
    companion: null,
  };
}

export function createState(progress: Progress = newProgress()): GameState {
  return {
    ticks: 0,
    ...progress,
    best: Math.max(progress.best, stageLevel(progress.world, progress.stage)),
    weaponLevels: [...progress.weaponLevels],
    // Old saves have no maxDps (0): start from what the hero does right now.
    maxDps: Math.max(progress.maxDps, heroDps(progress)),
    companion: progress.companion ? { ...progress.companion } : null,
    companionClickTick: null,
    companionAutoCharge: 0,
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
    companionPecks: [],
    companionAttackTick: null,
  };
}

/** Current hero damage per hit: the equipped weapon plus flat item damage. */
export function heroDamage(
  s: Pick<GameState, 'equipped' | 'weaponLevels'> & Partial<Pick<GameState, 'items'>>,
): number {
  const attack = weaponAttack(s.equipped);
  const weapon = weaponDamage(s.equipped, s.weaponLevels[s.equipped] ?? 0) * attack.damageMult;
  return safeInt(weapon + gearTotals(s.items).damage);
}

/**
 * Hero damage per second with the equipped weapon: damage per hit ÷ seconds
 * between attacks. Computed from weapon + level (not measured), so game
 * speed, pauses and intros can't inflate or deflate it. Whole number.
 */
export function heroDps(s: Pick<GameState, 'equipped' | 'weaponLevels'>): number {
  return safeInt(heroDamage(s) / weaponAttack(s.equipped).interval);
}

/** Raises `maxDps` to the current DPS if it's higher (mutates a draft). */
function trackMaxDps(s: GameState): void {
  s.maxDps = Math.max(s.maxDps, heroDps(s));
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
    companion: state.companion ? { ...state.companion } : null,
    duel: {
      ...state.duel,
      mob: { ...state.duel.mob },
      companionPecks: [...state.duel.companionPecks],
    },
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
  const gear = gearTotals(s.items);

  if (!d.heroSwung && t >= d.heroNextHit - secToTicks(windup(attack))) {
    d.heroSwung = true;
    d.heroAttackTick = t;
    s.events.push({ type: 'sfx', name: 'swing' });
  }
  if (t >= d.heroNextHit) {
    const dmg = heroDamage(s);
    d.mob.hp = Math.max(0, safeInt(d.mob.hp - dmg));
    d.mobHurtTick = t;
    d.heroNextHit += Math.max(1, secToTicks(attack.interval / (1 + gear.speed)));
    d.heroSwung = false;
    s.events.push({ type: 'damage', target: 'mob', amount: dmg }, { type: 'sfx', name: 'hit' });
  }
  companionCombat(s);
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
    onKill(s, s.world, s.stage);
    return;
  }

  if (!d.mobLunged && t >= d.mobNextHit - secToTicks(mobKindDef.windup)) {
    d.mobLunged = true;
    d.mobAttackTick = t;
  }
  if (t >= d.mobNextHit) {
    const dmg = mobHitDamage(d.mob.damage, gear.defence);
    d.heroHp = Math.max(0, safeInt(d.heroHp - dmg));
    d.heroHurtTick = t;
    d.mobNextHit += Math.max(1, secToTicks(mobKindDef.interval));
    d.mobLunged = false;
    s.events.push({ type: 'damage', target: 'hero', amount: dmg }, { type: 'sfx', name: 'hit' });
  }
  if (d.heroHp <= 0) {
    setPhase(d, 'heroDying');
    d.outcome = 'loss';
    s.deaths++;
    s.events.push({ type: 'sfx', name: 'heroDeath' });
  }
}

/** Companion auto attack and landing pecks. Only while `fighting`. */
function companionCombat(s: GameState): void {
  const d = s.duel;
  const def = companionDef(s);
  if (!def || !s.companion || d.phase !== 'fighting' || d.mob.hp <= 0) return;
  const t = d.tick;

  if (s.companion.autoUnlocked) {
    const interval = secToTicks(companionAutoInterval(def, s.companion.speedLevel));
    if (s.companionAutoCharge >= Math.max(1, interval)) {
      s.companionAutoCharge = 0;
      launchPeck(s, def);
    }
    s.companionAutoCharge++;
  }

  const due = d.companionPecks.filter((at) => at <= t);
  if (!due.length) return;
  d.companionPecks = d.companionPecks.filter((at) => at > t);
  const dmg = companionDamage(def, s.companion.dmgLevel);
  for (let i = 0; i < due.length && d.mob.hp > 0; i++) {
    d.mob.hp = Math.max(0, safeInt(d.mob.hp - dmg));
    d.mobHurtTick = t;
    s.events.push(
      { type: 'damage', target: 'mob', amount: dmg, source: 'companion' },
      { type: 'sfx', name: 'hit' },
    );
  }
}

/** Starts a peck: it lands after the attack's fly-out time. */
function launchPeck(s: GameState, def: CompanionDef): void {
  const d = s.duel;
  d.companionAttackTick = d.tick;
  d.companionPecks.push(d.tick + Math.max(1, secToTicks(windup(def.attack))));
}

export function companionDef(s: Pick<GameState, 'companion'>): CompanionDef | null {
  return s.companion ? COMPANIONS[s.companion.id] : null;
}

/** Click cooldown left, from 1 (just pecked) to 0 (ready). */
export function companionCooldown(s: GameState): number {
  const def = companionDef(s);
  if (!def || s.companionClickTick === null) return 0;
  const total = secToTicks(def.clickCooldown);
  return total > 0 ? Math.max(0, 1 - (s.ticks - s.companionClickTick) / total) : 0;
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
  trackMaxDps(next);
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
  trackMaxDps(next);
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

// ── Companion actions ──────────────────────────────────────────────────────

/** A click or tap on the game screen: the companion pecks, unless it's on cooldown. */
export function companionClick(s: GameState): GameState {
  const def = companionDef(s);
  if (!def || s.duel.phase !== 'fighting' || companionCooldown(s) > 0) return s;
  const next = draft(s);
  next.companionClickTick = s.ticks;
  launchPeck(next, def);
  return next;
}

/** The companion offered in the shop, or null (not unlocked yet, or the slot is taken). */
export function shopCompanion(s: Pick<GameState, 'best' | 'companion'>): CompanionDef | null {
  if (s.companion) return null;
  const def = COMPANIONS.crow;
  return s.best >= def.unlockLevel ? def : null;
}

export function canBuyCompanion(s: GameState): boolean {
  const def = shopCompanion(s);
  return def !== null && s.coins >= def.price;
}

/** Buys the companion; it goes straight into the companion slot. */
export function buyCompanion(s: GameState): GameState {
  const def = shopCompanion(s);
  if (!def || !canBuyCompanion(s)) return s;
  return purchase(s, def.price, (n) => {
    n.companion = { id: def.id, dmgLevel: 1, autoUnlocked: false, speedLevel: 1 };
  });
}

export type CompanionUpgrade = 'dmg' | 'auto' | 'speed';

/** Price of the next level of `kind`, or null when it can't be bought (no companion, maxed, locked). */
export function companionUpgradeCost(
  s: Pick<GameState, 'companion'>,
  kind: CompanionUpgrade,
): number | null {
  const c = s.companion;
  const def = companionDef(s);
  if (!c || !def) return null;
  switch (kind) {
    case 'dmg':
      return companionDmgCost(def, c.dmgLevel);
    case 'auto':
      return c.autoUnlocked ? null : def.autoPrice;
    case 'speed':
      return c.autoUnlocked && c.speedLevel < companionMaxSpeedLevel(def)
        ? companionSpeedCost(def, c.speedLevel)
        : null;
  }
}

export function canUpgradeCompanion(s: GameState, kind: CompanionUpgrade): boolean {
  const cost = companionUpgradeCost(s, kind);
  return cost !== null && s.coins >= cost;
}

export function upgradeCompanion(s: GameState, kind: CompanionUpgrade): GameState {
  const cost = companionUpgradeCost(s, kind);
  if (cost === null || s.coins < cost) return s;
  return purchase(s, cost, (n) => {
    const c = n.companion!;
    if (kind === 'dmg') c.dmgLevel++;
    else if (kind === 'speed') c.speedLevel++;
    else {
      c.autoUnlocked = true;
      n.companionAutoCharge = 0;
    }
  });
}

function purchase(s: GameState, cost: number, apply: (next: GameState) => void): GameState {
  const next = draft(s);
  next.coins = safeInt(s.coins - cost);
  apply(next);
  next.events.push({ type: 'sfx', name: 'purchase' }, { type: 'save' });
  return next;
}
