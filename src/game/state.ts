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
  companionAutoInterval,
  companionDamage,
  companionDmgCost,
  companionMaxSpeedLevel,
  companionSpeedCost,
  characterCost,
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
import { gearTotals, mobHitDamage, newGear, onKill, type Gear, type Item } from './items';
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
  /** Highest `heroDps` ever reached (local stat; the future ranking value). */
  maxDps: number;
  /** Ring, pendant, bag and the drop RNG (game/items.ts). */
  items: Gear;
  companion: Companion | null;
  /** Coin upgrades bought in Shop → Character. */
  character: Character;
  /**
   * Crit RNG state (uint32, mulberry32 like the drop RNG). Not saved: it is
   * derived from the drop seed on load. Tests can set it to fix the rolls.
   */
  critRng: number;
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
  | 'revealedWeapons'
  | 'equipped'
  | 'kills'
  | 'deaths'
  | 'maxDps'
  | 'items'
  | 'companion'
  | 'character'
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
    items: newGear(),
    companion: null,
    character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
  };
}

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
    companion: progress.companion ? { ...progress.companion } : null,
    character: { ...progress.character },
    critRng: critSeed(progress.items),
    companionClickTick: null,
    companionAutoCharge: 0,
    // The first duel after Start/Continue always gets the full intro.
    duel: newDuel(progress.world, progress.stage, true, heroMaxHp(progress)),
    events: [],
  };
}

/** Crit RNG seed for a loaded game: the drop seed, scrambled so the two streams differ. */
const critSeed = (g: Pick<Gear, 'rng'>): number => (g.rng ^ 0x9e3779b9) >>> 0;

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

/** Max HP: the base plus the coin upgrade. */
export function heroMaxHp(s: Partial<Pick<GameState, 'character'>>): number {
  return safeInt(HERO_MAX_HP + hpFromLevel(s.character?.hpLevel ?? 0));
}

/** Total defence: equipped items plus the coin upgrade. */
export function heroDefence(s: Partial<Pick<GameState, 'items' | 'character'>>): number {
  return safeInt(gearTotals(s.items).defence + defenceFromLevel(s.character?.defenceLevel ?? 0));
}

/**
 * Chance (0–`CRIT.maxChance`) that a hero hit is a critical hit: the coin
 * upgrade plus equipped items, capped.
 */
export function critChance(s: Partial<Pick<GameState, 'items' | 'character'>>): number {
  return capCritChance(critFromLevel(s.character?.critLevel ?? 0) + gearTotals(s.items).crit);
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
  // Coins only go up while fighting (kills, auto-sold drops): an open shop updates.
  if (revealWeapons(s)) s.events.push({ type: 'save' });
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
  const gear = gearTotals(s.items);

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
    d.heroNextHit += Math.max(1, secToTicks(attack.interval / (1 + gear.speed)));
    d.heroSwung = false;
    s.events.push(
      crit
        ? { type: 'damage', target: 'mob', amount: dmg, crit: true }
        : { type: 'damage', target: 'mob', amount: dmg },
      { type: 'sfx', name: crit ? 'crit' : 'hit' },
    );
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
  const dmg = companionDamage(def, s.companion.dmgLevel, heroDamage(s));
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
  | { type: 'companion'; kind: 'dmg' | 'speed' };

type Track = {
  level: number;
  costAt(level: number): number;
  set(n: GameState, level: number): void;
};

function track(
  s: Pick<GameState, 'weaponLevels' | 'character' | 'companion'>,
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
      const c = s.companion;
      const def = companionDef(s);
      if (!c || !def || (t.kind === 'speed' && !c.autoUnlocked)) return null;
      const dmg = t.kind === 'dmg';
      return {
        level: dmg ? c.dmgLevel : c.speedLevel,
        costAt: (l) => (dmg ? companionDmgCost(def, l) : companionSpeedCost(def, l)),
        set: (n, l) => {
          n.companion = { ...n.companion!, [dmg ? 'dmgLevel' : 'speedLevel']: l };
        },
      };
    }
  }
}

/** Levels and total price of buying `amount` of `t` now (`levels` 0 = nothing to buy). */
export function upgradeQuote(
  s: Pick<GameState, 'coins' | 'weaponLevels' | 'character' | 'companion'>,
  t: UpgradeTarget,
  amount: BuyAmount,
): BulkQuote {
  const tr = track(s, t);
  return tr ? bulkQuote(tr.costAt, tr.level, amount, s.coins) : { levels: 0, cost: 0 };
}

/** True when the upgrade is bought up as far as it goes (e.g. crit at its cap). */
export function upgradeMaxed(
  s: Pick<GameState, 'weaponLevels' | 'character' | 'companion'>,
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
  s: Pick<GameState, 'world' | 'stage' | 'best' | 'autoAdvance' | 'duel'>,
  dir: 'prev' | 'next',
): { world: number; stage: number } | null {
  if (s.duel.phase === 'heroDying') return null;
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
  if (kind !== 'auto') return buyUpgrades(s, { type: 'companion', kind }, 1);
  if (cost === null || s.coins < cost) return s;
  return purchase(s, cost, (n) => {
    n.companion!.autoUnlocked = true;
    n.companionAutoCharge = 0;
  });
}

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
