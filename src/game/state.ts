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
  bulkQuote,
  capCritChance,
  companionDamage,
  companionUpgradeCostAt,
  characterCost,
  COMPANION_IDS,
  COMPANIONS,
  critDamage,
  critFromLevel,
  defenceFromLevel,
  DUEL,
  HERO_MAX_HP,
  hpFromLevel,
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
  type BulkQuote,
  type BuyAmount,
  type CompanionDef,
  type CompanionId,
  type MobKind,
} from './balance';
import {
  bestOwnedItem,
  betterItem,
  gearTotals,
  mobHitDamage,
  newGear,
  onKill,
  type Gear,
  type Item,
} from './items';
import {
  addPassive,
  ascendsOf,
  EXTRA_HIT_MULT,
  passiveTotals,
  picksEnabled,
  rollPickOptions,
  type Passive,
  type PickOption,
} from './passives';
import { revealedWeapons, revealWeapons } from './reveal';
import { nextFloat } from './rng';

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
  /** Per companion: duel ticks when its attacks in flight land. Dropped with the duel. */
  companionPecks: PerCompanion<number[]>;
  /** Per companion: duel tick its last attack started (fly-out / lunge animation). */
  companionAttackTick: PerCompanion<number | null>;
  /** Per companion: the part of `companionPecks` that came from a click (they get the click bonus). */
  companionClickPecks: PerCompanion<number[]>;
};

/** One value per companion id. */
export type PerCompanion<T> = Record<CompanionId, T>;

/** Builds a `PerCompanion` by calling `make` for every companion. */
export const perCompanion = <T>(make: (id: CompanionId) => T): PerCompanion<T> =>
  Object.fromEntries(COMPANION_IDS.map((id) => [id, make(id)])) as PerCompanion<T>;

/**
 * Companion levels (0 = not bought). A bought companion is owned for good and
 * has one upgrade: its level. Saved as is.
 */
export type CompanionLevels = PerCompanion<number>;

/** Character upgrade levels (0 = not bought). Saved as is. */
export type Character = { defenceLevel: number; critLevel: number; hpLevel: number };

export type GameEvent =
  | { type: 'sfx'; name: SfxName }
  | {
      type: 'damage';
      target: 'hero' | 'mob';
      amount: number;
      source?: 'companion';
      /** A critical hero hit: shown bigger, with its own sound. */
      crit?: true;
    }
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
  /** Per weapon tier: shown in Shop → Weapons (game/reveal.ts). Never goes back to false. */
  revealedWeapons: boolean[];
  equipped: number;
  kills: number;
  deaths: number;
  /** Highest `heroDps` ever reached (local stat; the future ranking value). Survives an ascend. */
  maxDps: number;
  /** Times the player has ascended (game/ascend.ts). Plain count, 0 in a new game. */
  ascends: number;
  /** Highest stage level ever reached, across ascends (`best` is this run's). */
  bestStage: number;
  /** The best item ever owned (tier, then total stat value), even if it was sold. Survives an ascend. */
  bestItem: Item | null;
  /** The four equipped slots, the bag and the drop RNG (game/items.ts). */
  items: Gear;
  companions: CompanionLevels;
  /** Coin upgrades bought in Shop → Character. */
  character: Character;
  /** Passive skills picked after stage clears (game/passives.ts). */
  passives: Passive[];
  /**
   * The offer waiting for the player after a stage clear, or null. While it is
   * set the duel is frozen: the fight waits for the pick (no timer picks for you).
   */
  pick: PickOption[] | null;
  /** Roll RNG for pick offers (uint32). Not saved: derived from the drop seed on load. */
  pickRng: number;
  /**
   * Crit RNG state (uint32, mulberry32 like the drop RNG). Not saved: it is
   * derived from the drop seed on load. Tests can set it to fix the rolls.
   */
  critRng: number;
  /** `ticks` of the last click attack, for the click cooldown (not saved). */
  companionClickTick: number | null;
  /** Per companion: fighting ticks since its last auto attack (not saved). */
  companionAutoCharge: PerCompanion<number>;
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
  | 'revealedWeapons'
  | 'equipped'
  | 'kills'
  | 'deaths'
  | 'maxDps'
  | 'ascends'
  | 'bestStage'
  | 'bestItem'
  | 'items'
  | 'companions'
  | 'character'
  | 'passives'
  | 'pick'
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
    revealedWeapons: revealedWeapons([1], 0),
    equipped: 0,
    kills: 0,
    deaths: 0,
    maxDps: 0,
    ascends: 0,
    bestStage: 1,
    bestItem: null,
    items: newGear(),
    companions: newCompanions(),
    character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
    passives: [],
    pick: null,
  };
}

/** Nothing bought yet. */
export const newCompanions = (): CompanionLevels => perCompanion(() => 0);

export function createState(progress: Progress = newProgress()): GameState {
  return {
    ticks: 0,
    ...progress,
    best: Math.max(progress.best, stageLevel(progress.world, progress.stage)),
    weaponLevels: [...progress.weaponLevels],
    revealedWeapons: revealedWeapons(
      progress.weaponLevels,
      progress.coins,
      progress.revealedWeapons,
    ),
    // Old saves have no maxDps (0): start from what the hero does right now.
    maxDps: Math.max(progress.maxDps, heroDps(progress)),
    // Old saves have no records: start them from what the player has now.
    bestStage: Math.max(
      progress.bestStage,
      progress.best,
      stageLevel(progress.world, progress.stage),
    ),
    bestItem: betterItem(progress.bestItem, bestOwnedItem(progress.items)),
    companions: { ...newCompanions(), ...progress.companions },
    character: { ...progress.character },
    passives: progress.passives.map((p) => ({ ...p })),
    pick: progress.pick ? progress.pick.map((o) => ({ ...o })) : null,
    pickRng: pickSeed(progress.items),
    critRng: critSeed(progress.items),
    companionClickTick: null,
    companionAutoCharge: perCompanion(() => 0),
    // The first duel after Start/Continue always gets the full intro.
    duel: newDuel(progress.world, progress.stage, true, heroMaxHp(progress)),
    events: [],
  };
}

/** Crit RNG seed for a loaded game: the drop seed, scrambled so the two streams differ. */
const critSeed = (g: Pick<Gear, 'rng'>): number => (g.rng ^ 0x9e3779b9) >>> 0;
/** Same for the pick offers: a third stream. */
const pickSeed = (g: Pick<Gear, 'rng'>): number => (g.rng ^ 0x85ebca6b) >>> 0;

export function newDuel(
  world: number,
  stage: number,
  fullIntro: boolean,
  maxHp: number = HERO_MAX_HP,
): Duel {
  const hp = mobHp(world, stage);
  const introTicks = secToTicks(fullIntro ? DUEL.intro : DUEL.shortIntro);
  return {
    phase: 'intro',
    tick: 0,
    phaseTick: 0,
    introTicks,
    outcome: null,
    heroHp: maxHp,
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
    companionPecks: perCompanion(() => []),
    companionAttackTick: perCompanion(() => null),
    companionClickPecks: perCompanion(() => []),
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
export function heroDps(
  s: Pick<GameState, 'equipped' | 'weaponLevels'> & Partial<Pick<GameState, 'items' | 'passives'>>,
): number {
  return safeInt((heroDamage(s) * (1 + heroSpeedBonus(s))) / weaponAttack(s.equipped).interval);
}

/** Faster swings: equipped items (capped) plus passives (capped). 0.1 = 10 % faster. */
export function heroSpeedBonus(s: Partial<Pick<GameState, 'items' | 'passives'>>): number {
  return gearTotals(s.items).speed + passiveTotals(s.passives).speed;
}

/** Chance (0–1) that a hero hit is followed by an extra strike for `EXTRA_HIT_MULT` of the hit. */
export function extraHitChance(s: Partial<Pick<GameState, 'passives'>>): number {
  return passiveTotals(s.passives).extra;
}

/** Share of the hero's hit added to the crow's click pecks (0.1 = +10 %). */
export function clickBonus(s: Partial<Pick<GameState, 'passives'>>): number {
  return passiveTotals(s.passives).click;
}

/** Max HP: the base plus the coin upgrade. */
export function heroMaxHp(s: Partial<Pick<GameState, 'character'>>): number {
  return safeInt(HERO_MAX_HP + hpFromLevel(s.character?.hpLevel ?? 0));
}

/** Total defence: equipped items, the coin upgrade and passives. */
export function heroDefence(
  s: Partial<Pick<GameState, 'items' | 'character' | 'passives'>>,
): number {
  return safeInt(
    gearTotals(s.items).defence +
      defenceFromLevel(s.character?.defenceLevel ?? 0) +
      passiveTotals(s.passives).defence,
  );
}

/**
 * Chance (0–`CRIT.maxChance`) that a hero hit is a critical hit: the coin
 * upgrade plus equipped items plus passives, capped.
 */
export function critChance(
  s: Partial<Pick<GameState, 'items' | 'character' | 'passives'>>,
): number {
  return capCritChance(
    critFromLevel(s.character?.critLevel ?? 0) +
      gearTotals(s.items).crit +
      passiveTotals(s.passives).crit,
  );
}

/** Raises `maxDps` to the current DPS if it's higher (mutates a draft). */
function trackMaxDps(s: GameState): void {
  s.maxDps = Math.max(s.maxDps, heroDps(s));
}

/** Raises the all-time records (`maxDps`, `bestStage`) to the current values (mutates a draft). */
function trackRecords(s: GameState): void {
  trackMaxDps(s);
  s.bestStage = Math.max(s.bestStage, s.best);
}

/** Advances `dt` seconds in whole fixed ticks (the loop always passes one tick). */
export function update(state: GameState, dt: number): GameState {
  const n = Math.max(1, Math.round(dt * TICK_RATE));
  const s = draft(state);
  for (let i = 0; i < n; i++) step(s);
  trackRecords(s);
  // Coins only go up while fighting (kills, auto-sold drops): an open shop updates.
  if (revealWeapons(s)) s.events.push({ type: 'save' });
  return s;
}

/** Shallow copy of everything `step` mutates, with a fresh event list. */
function draft(state: GameState): GameState {
  return {
    ...state,
    weaponLevels: [...state.weaponLevels],
    companions: { ...state.companions },
    companionAutoCharge: { ...state.companionAutoCharge },
    duel: {
      ...state.duel,
      mob: { ...state.duel.mob },
      companionPecks: perCompanion((id) => [...state.duel.companionPecks[id]]),
      companionAttackTick: { ...state.duel.companionAttackTick },
      companionClickPecks: perCompanion((id) => [...state.duel.companionClickPecks[id]]),
    },
    events: [],
  };
}

function step(s: GameState): void {
  s.ticks++;
  // A pending pick freezes the duel: the fight waits for the player.
  if (s.pick) return;
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
          const cleared = stageLevel(s.world, s.stage);
          advanceStage(s);
          s.events.push({ type: 'sfx', name: 'stageClear' });
          // Only the first clear of a stage offers a pick, so replaying can't farm them.
          if (cleared >= s.best) offerPick(s);
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
        s.duel = newDuel(s.world, s.stage, isNew, heroMaxHp(s));
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
    // Always one roll per hero hit, so the RNG stream doesn't depend on the chance.
    const rng = { state: s.critRng };
    const crit = nextFloat(rng) < critChance(s);
    s.critRng = rng.state;
    const dmg = crit ? critDamage(heroDamage(s)) : heroDamage(s);
    d.mob.hp = Math.max(0, safeInt(d.mob.hp - dmg));
    d.mobHurtTick = t;
    d.heroNextHit += Math.max(1, secToTicks(attack.interval / (1 + heroSpeedBonus(s))));
    d.heroSwung = false;
    s.events.push(
      crit
        ? { type: 'damage', target: 'mob', amount: dmg, crit: true }
        : { type: 'damage', target: 'mob', amount: dmg },
      { type: 'sfx', name: crit ? 'crit' : 'hit' },
    );
    extraStrike(s);
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
    const dmg = mobHitDamage(d.mob.damage, heroDefence(s));
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

/**
 * "Second strike" passive: after a hero hit, a chance for one more strike
 * worth `EXTRA_HIT_MULT` of a normal hit (never a crit). The roll is only
 * made when the player has the passive, so the crit stream is unchanged
 * without it.
 */
function extraStrike(s: GameState): void {
  const chance = extraHitChance(s);
  if (!(chance > 0) || s.duel.mob.hp <= 0) return;
  const rng = { state: s.critRng };
  const hit = nextFloat(rng) < chance;
  s.critRng = rng.state;
  if (!hit) return;
  const dmg = Math.max(1, safeInt(heroDamage(s) * EXTRA_HIT_MULT));
  s.duel.mob.hp = Math.max(0, safeInt(s.duel.mob.hp - dmg));
  s.events.push({ type: 'damage', target: 'mob', amount: dmg }, { type: 'sfx', name: 'hit' });
}

/** Companions owned (level 1 or more), in shop order. */
export const ownedCompanions = (s: Pick<GameState, 'companions'>): CompanionDef[] =>
  COMPANION_IDS.filter((id) => s.companions[id] >= 1).map((id) => COMPANIONS[id]);

/**
 * Companion auto attacks and landing hits. Only while `fighting`. Every owned
 * companion has its own timer, so they never wait for each other.
 */
function companionCombat(s: GameState): void {
  const d = s.duel;
  if (d.phase !== 'fighting' || d.mob.hp <= 0) return;
  const t = d.tick;

  for (const def of ownedCompanions(s)) {
    const interval = Math.max(1, secToTicks(def.attack.interval));
    if (s.companionAutoCharge[def.id] >= interval) {
      s.companionAutoCharge[def.id] = 0;
      launchAttack(s, def);
    }
    s.companionAutoCharge[def.id]++;

    const due = d.companionPecks[def.id].filter((at) => at <= t);
    if (!due.length) continue;
    d.companionPecks[def.id] = d.companionPecks[def.id].filter((at) => at > t);
    const base = companionDamage(def, s.companions[def.id], heroDamage(s));
    const clickExtra = safeInt(heroDamage(s) * clickBonus(s));
    for (let i = 0; i < due.length && d.mob.hp > 0; i++) {
      // An attack that came from a click also gets the "Heavy touch" bonus (the crow's clicks).
      const click = d.companionClickPecks[def.id].indexOf(due[i]);
      if (click >= 0) d.companionClickPecks[def.id].splice(click, 1);
      const dmg = click >= 0 ? base + clickExtra : base;
      d.mob.hp = Math.max(0, safeInt(d.mob.hp - dmg));
      d.mobHurtTick = t;
      s.events.push(
        { type: 'damage', target: 'mob', amount: dmg, source: 'companion' },
        { type: 'sfx', name: 'hit' },
      );
    }
  }
}

/** Starts an attack: it lands after the attack's wind-up (the crow's fly-out, the wolf's lunge). */
function launchAttack(s: GameState, def: CompanionDef, click = false): void {
  const d = s.duel;
  d.companionAttackTick[def.id] = d.tick;
  const lands = d.tick + Math.max(1, secToTicks(windup(def.attack)));
  d.companionPecks[def.id].push(lands);
  if (click) d.companionClickPecks[def.id].push(lands);
}

/** The companion that attacks on a click: the first owned one with a click cooldown (the crow). */
export function clickerDef(s: Pick<GameState, 'companions'>): CompanionDef | null {
  return ownedCompanions(s).find((def) => def.clickCooldown !== null) ?? null;
}

/** Click cooldown left, from 1 (just attacked) to 0 (ready). */
export function companionCooldown(s: GameState): number {
  const def = clickerDef(s);
  if (!def || def.clickCooldown === null || s.companionClickTick === null) return 0;
  const total = secToTicks(def.clickCooldown);
  return total > 0 ? Math.max(0, 1 - (s.ticks - s.companionClickTick) / total) : 0;
}

function advanceStage(s: { world: number; stage: number }): void {
  if (s.stage >= STAGES_PER_WORLD) {
    s.world++;
    s.stage = 1;
  } else {
    s.stage++;
  }
}

/** One stage back: 2.1 → 1.6, 1.1 stays 1.1. */
function rollbackStage(s: { world: number; stage: number }): void {
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
  return canBuyUpgrades(s, { type: 'weapon', tier: s.equipped }, 1);
}

/** One level for the equipped weapon. */
export const buyUpgrade = (s: GameState): GameState =>
  buyUpgrades(s, { type: 'weapon', tier: s.equipped }, 1);

// ── Levelled upgrades, bought ×1 / ×10 / ×100 / MAX ─────────────────────────

/** Anything bought level by level. Weapons don't have to be equipped (only owned). */
export type UpgradeTarget =
  | { type: 'weapon'; tier: number }
  | { type: 'defence' }
  | { type: 'crit' }
  | { type: 'hp' }
  | { type: 'companion'; id: CompanionId };

type Track = {
  level: number;
  costAt(level: number): number;
  set(n: GameState, level: number): void;
};

function track(
  s: Pick<GameState, 'weaponLevels' | 'character' | 'companions'>,
  t: UpgradeTarget,
): Track | null {
  switch (t.type) {
    case 'weapon': {
      const level = s.weaponLevels[t.tier] ?? 0;
      if (!(level >= 1)) return null;
      return {
        level,
        costAt: (l) => upgradeCost(t.tier, l),
        set: (n, l) => {
          n.weaponLevels[t.tier] = l;
          trackMaxDps(n);
        },
      };
    }
    case 'defence':
      return {
        level: s.character.defenceLevel,
        costAt: (l) => characterCost('defence', l),
        set: (n, l) => {
          n.character = { ...n.character, defenceLevel: l };
        },
      };
    case 'crit':
      return {
        level: s.character.critLevel,
        costAt: (l) => characterCost('crit', l),
        set: (n, l) => {
          n.character = { ...n.character, critLevel: l };
        },
      };
    case 'hp':
      return {
        level: s.character.hpLevel,
        costAt: (l) => characterCost('hp', l),
        set: (n, l) => {
          // The new max HP is healed in too, so the bar doesn't lag behind mid-duel.
          const before = heroMaxHp(n);
          n.character = { ...n.character, hpLevel: l };
          if (n.duel.heroHp > 0) n.duel.heroHp += heroMaxHp(n) - before;
        },
      };
    case 'companion': {
      const level = s.companions[t.id];
      if (!(level >= 1)) return null;
      return {
        level,
        costAt: (l) => companionUpgradeCostAt(COMPANIONS[t.id], l),
        set: (n, l) => {
          n.companions = { ...n.companions, [t.id]: l };
        },
      };
    }
  }
}

/** Levels and total price of buying `amount` of `t` now (`levels` 0 = nothing to buy). */
export function upgradeQuote(
  s: Pick<GameState, 'coins' | 'weaponLevels' | 'character' | 'companions'>,
  t: UpgradeTarget,
  amount: BuyAmount,
): BulkQuote {
  const tr = track(s, t);
  return tr ? bulkQuote(tr.costAt, tr.level, amount, s.coins) : { levels: 0, cost: 0 };
}

/** True when the upgrade is bought up as far as it goes (e.g. crit at its cap). */
export function upgradeMaxed(
  s: Pick<GameState, 'weaponLevels' | 'character' | 'companions'>,
  t: UpgradeTarget,
): boolean {
  const tr = track(s, t);
  return !!tr && tr.costAt(tr.level) >= Number.MAX_SAFE_INTEGER;
}

export function canBuyUpgrades(s: GameState, t: UpgradeTarget, amount: BuyAmount): boolean {
  const q = upgradeQuote(s, t, amount);
  return q.levels > 0 && s.coins >= q.cost;
}

/** Buys all the quoted levels at once, or nothing (same object back). */
export function buyUpgrades(s: GameState, t: UpgradeTarget, amount: BuyAmount): GameState {
  const tr = track(s, t);
  const q = upgradeQuote(s, t, amount);
  if (!tr || q.levels < 1 || s.coins < q.cost) return s;
  return purchase(s, q.cost, (n) => tr.set(n, tr.level + q.levels));
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

// ── Stage switch ───────────────────────────────────────────────────────────

/**
 * Highest stage level the player may switch to now: `best`, plus the stage a
 * win that is still resolving is about to unlock. In `mobDying` with
 * auto-advance on, that is the next stage; in `transition` the stage has
 * already moved on but `best` only catches up when the next duel starts.
 * Switching away must not lose that unlock.
 */
function unlockedLevel(
  s: Pick<GameState, 'world' | 'stage' | 'best' | 'autoAdvance' | 'duel'>,
): number {
  const level = stageLevel(s.world, s.stage);
  if (s.duel.phase === 'transition') return Math.max(s.best, level);
  if (s.duel.phase === 'mobDying' && s.autoAdvance) return Math.max(s.best, level + 1);
  return s.best;
}

/**
 * Where a stage switch would go: one stage back (same as the death rollback,
 * 1.1 stays 1.1) or forward (1.6 → 2.1). `null` when there is nowhere to go,
 * when the target is locked (above the highest stage reached), or while the
 * hero is dying: the death still has to roll back a stage and turn
 * auto-advance off, so it can't be dodged by switching.
 */
export function stageSwitchTarget(
  s: Pick<GameState, 'world' | 'stage' | 'best' | 'autoAdvance' | 'duel'> &
    Partial<Pick<GameState, 'pick'>>,
  dir: 'prev' | 'next',
): { world: number; stage: number } | null {
  if (s.duel.phase === 'heroDying' || s.pick) return null;
  const to = { world: s.world, stage: s.stage };
  if (dir === 'prev') rollbackStage(to);
  else advanceStage(to);
  const level = stageLevel(to.world, to.stage);
  if (level === stageLevel(s.world, s.stage) || level > unlockedLevel(s)) return null;
  return to;
}

/**
 * Moves to the previous or next stage and starts a fresh duel there. Coins,
 * items and upgrades stay, and no stage-clear reward or sound plays. Auto-advance
 * is left as it is: farming an earlier stage is fine, and only a death turns it
 * off. Returns the same state when the switch is not allowed.
 */
export function switchStage(s: GameState, dir: 'prev' | 'next'): GameState {
  const to = stageSwitchTarget(s, dir);
  if (!to) return s;
  const next = draft(s);
  const level = stageLevel(to.world, to.stage);
  next.world = to.world;
  next.stage = to.stage;
  next.best = Math.max(unlockedLevel(s), level);
  trackRecords(next);
  // Same rule as the transition: the full intro only for a stage reached for the first time.
  next.duel = newDuel(to.world, to.stage, level > s.best);
  next.events.push({ type: 'save' });
  if (isBoss(to.stage)) next.events.push({ type: 'sfx', name: 'bossAppear' });
  return next;
}

export function setAutoAdvance(s: GameState, on: boolean): GameState {
  if (s.autoAdvance === on) return s;
  const next = draft(s);
  next.autoAdvance = on;
  next.events.push({ type: 'save' });
  return next;
}

// ── Stage picks ────────────────────────────────────────────────────────────

/** Rolls an offer into `s.pick` (mutates a draft). Does nothing if picks are off or one is pending. */
function offerPick(s: GameState): void {
  if (!picksEnabled() || s.pick) return;
  const rng = { state: s.pickRng };
  s.pick = rollPickOptions(rng, ascendsOf(s));
  s.pickRng = rng.state;
  s.events.push({ type: 'save' });
}

/** Debugger: offers a pick right now, mid-fight or not. Same state back if one is already open. */
export function forcePickOffer(s: GameState): GameState {
  if (s.pick) return s;
  const next = draft(s);
  const rng = { state: s.pickRng };
  next.pick = rollPickOptions(rng, ascendsOf(s));
  next.pickRng = rng.state;
  next.events.push({ type: 'save' });
  return next;
}

/** Takes option `index` of the open offer into the passives and lets the fight go on. */
export function choosePick(s: GameState, index: number): GameState {
  const option = s.pick?.[index];
  if (!s.pick || !option) return s;
  const next = draft(s);
  next.passives = addPassive(s.passives, option);
  next.pick = null;
  trackMaxDps(next);
  next.events.push({ type: 'sfx', name: 'purchase' }, { type: 'save' });
  return next;
}

// ── Companion actions ──────────────────────────────────────────────────────

/** A click or tap on the game screen: the clicker (crow) attacks, unless it's on cooldown. */
export function companionClick(s: GameState): GameState {
  const def = clickerDef(s);
  if (!def || s.duel.phase !== 'fighting' || companionCooldown(s) > 0) return s;
  const next = draft(s);
  next.companionClickTick = s.ticks;
  launchAttack(next, def, true);
  return next;
}

/** `owned`: bought. `offer`: in the shop and can be bought. `locked`: not unlocked yet. */
export type CompanionStatus = 'owned' | 'offer' | 'locked';

export function companionStatus(
  s: Pick<GameState, 'best' | 'companions'>,
  id: CompanionId,
): CompanionStatus {
  if (s.companions[id] >= 1) return 'owned';
  return s.best >= COMPANIONS[id].unlockLevel ? 'offer' : 'locked';
}

export function canBuyCompanion(s: GameState, id: CompanionId): boolean {
  return companionStatus(s, id) === 'offer' && s.coins >= COMPANIONS[id].price;
}

/** Buys a companion at level 1; it starts attacking at once. */
export function buyCompanion(s: GameState, id: CompanionId): GameState {
  if (!canBuyCompanion(s, id)) return s;
  return purchase(s, COMPANIONS[id].price, (n) => {
    n.companions = { ...n.companions, [id]: 1 };
    n.companionAutoCharge[id] = 0;
  });
}

/** Price of the next level, or null when the companion isn't owned. */
export function companionUpgradeCost(
  s: Pick<GameState, 'companions'>,
  id: CompanionId,
): number | null {
  const level = s.companions[id];
  return level >= 1 ? companionUpgradeCostAt(COMPANIONS[id], level) : null;
}

export function canUpgradeCompanion(s: GameState, id: CompanionId): boolean {
  const cost = companionUpgradeCost(s, id);
  return cost !== null && s.coins >= cost;
}

/** One level for a companion (more at a time: `buyUpgrades` with a `{ type: 'companion' }` target). */
export const upgradeCompanion = (s: GameState, id: CompanionId): GameState =>
  buyUpgrades(s, { type: 'companion', id }, 1);

// ── Character upgrades ─────────────────────────────────────────────────────

export const defenceCost = (s: Pick<GameState, 'character'>): number =>
  characterCost('defence', s.character.defenceLevel);

export const critCost = (s: Pick<GameState, 'character'>): number =>
  characterCost('crit', s.character.critLevel);

export const hpCost = (s: Pick<GameState, 'character'>): number =>
  characterCost('hp', s.character.hpLevel);

export function canBuyDefence(s: GameState): boolean {
  return s.coins >= defenceCost(s);
}

/** Buys one defence level. */
export const buyDefence = (s: GameState): GameState => buyUpgrades(s, { type: 'defence' }, 1);

/** Buys one max HP level. */
export const buyHp = (s: GameState): GameState => buyUpgrades(s, { type: 'hp' }, 1);

/** Buys one crit chance level. */
export const buyCrit = (s: GameState): GameState => buyUpgrades(s, { type: 'crit' }, 1);

function purchase(s: GameState, cost: number, apply: (next: GameState) => void): GameState {
  const next = draft(s);
  next.coins = safeInt(s.coins - cost);
  apply(next);
  next.events.push({ type: 'sfx', name: 'purchase' }, { type: 'save' });
  return next;
}
