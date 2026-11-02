import { weaponAttack, windup } from '../game/attacks';
import { DUEL, isBoss, MOB_KINDS, type MobKind } from '../game/balance';
import { formatNumber } from '../game/format';
import { companionDef, secToTicks, type GameEvent, type GameState } from '../game/state';
import { TICK_RATE } from '../loop';
import {
  bossMushroomWalk,
  companionSprites,
  heroAnimations,
  heroWeaponAnchors,
  mobs,
  slashArcFrames,
  slashArcOffset,
  slashArcs,
  weapons,
  type CompanionAnimation,
  type CompanionSprites,
  type HeroAnimation,
  type SpriteDef,
} from '../sprites';
import type { Palette } from '../theme';
import { FONT_STACK, snapFontSize } from '../ui/font';
import { frameAt, type SpriteCache } from './sprites';
import type { View } from './view';

/** Art-pixel rows below the characters' feet (there is no drawn ground line). */
const GROUND = 4;
/** Art pixels above the tallest sprite: exactly the mob HP bar (drawn 6 px above the mob). */
const TOP_GAP = 6;
/** Side margin and the minimum gap between hero and mob, in art pixels. */
const MARGIN = 8;
const COMPACT_MARGIN = 2;
const FLASH = 0.12;
const MOB_LUNGE = 6;
const MOB_LUNGE_BACK = 0.15;
const TEXT_LIFE = 0.9;
const TEXT_RISE = 14;
/** Companion damage numbers: an existing accent until the palette step picks a shade. */
const COMPANION_DMG_COLOR: keyof Palette = 'blue';
/** Companion flight back to the perch after the peck's hit frame, in seconds. */
const PECK_BACK = 0.23;
/** Up-arc of the companion's flight, in art pixels. */
const FLIGHT_ARC = 6;
/**
 * Where the companion's feet (bottom row, centre) rest, relative to the idle
 * hero's top-left: on the left of the hat brim (hero.ts, row 13).
 */
const PERCH = { x: 10, y: 14 };
/** Click feedback: a pixel burst at the pointer. */
const CLICK_LIFE = 0.25;
const CLICK_RADIUS = { from: 2, to: 7 };
/** Companion sprite sets by `CompanionDef.sprites`. */
const COMPANION_SPRITES: Record<string, CompanionSprites> = companionSprites;

const MOB_SPRITES: Record<MobKind, SpriteDef> = { ...mobs, boss: bossMushroomWalk };
const heroSprites = Object.values(heroAnimations);

const heroWidth = () => Math.max(...heroSprites.map((d) => d.width));
const mobWidth = () => Math.max(...Object.values(MOB_SPRITES).map((d) => d.width));

/**
 * Scene size in art pixels, read from the sprites so a taller hero (or a
 * bigger boss) just changes the scale instead of breaking the layout.
 * `compact` (narrow boxes) uses tight margins and lets the slash arc reach
 * into the gap, so the characters can be drawn bigger.
 */
export function sceneContent(compact = false): { width: number; height: number } {
  const heroW = compact
    ? heroWidth()
    : Math.max(heroWidth(), ...slashArcs.map((a) => slashArcOffset.x + a.width));
  const tallest = Math.max(
    ...heroSprites.map((d) => d.height),
    ...Object.values(MOB_SPRITES).map((d) => d.height),
  );
  const margin = compact ? COMPACT_MARGIN : MARGIN;
  return { width: heroW + mobWidth() + margin * 3, height: tallest + GROUND + TOP_GAP };
}

type FloatText = { text: string; color: keyof Palette; x: number; y: number; born: number };
type ClickMark = { x: number; y: number; born: number };

const seconds = (ticks: number) => ticks / TICK_RATE;

export class SceneRenderer {
  private texts: FloatText[] = [];
  private clicks: ClickMark[] = [];
  private nudge = 0;

  /** A click or tap at device pixel (`px`, `py`) on the canvas: shows a short burst there. */
  onClick(s: GameState, px: number, py: number, view: View): void {
    this.clicks.push({ x: px / view.scale, y: (py - view.offsetY) / view.scale, born: s.ticks });
  }

  /** Turns logic events into floating numbers. Positions are resolved at draw time. */
  onEvents(s: GameState, events: readonly GameEvent[], view: View): void {
    const l = layout(s, view);
    for (const e of events) {
      const jitter = (this.nudge++ % 3) * 4 - 4;
      if (e.type === 'damage') {
        const onMob = e.target === 'mob';
        this.texts.push({
          text: formatNumber(e.amount),
          color: e.source === 'companion' ? COMPANION_DMG_COLOR : onMob ? 'fg' : 'red',
          x: (onMob ? l.mobX + l.mob.width / 2 : l.heroX + l.hero.width / 2) + jitter,
          y: (onMob ? l.mobY : l.heroY) - 6,
          born: s.ticks,
        });
      } else if (e.type === 'coins') {
        this.texts.push({
          text: `+${formatNumber(e.amount)}`,
          color: 'orange',
          x: l.mobX + l.mob.width / 2,
          y: l.mobY + l.mob.height / 2,
          born: s.ticks,
        });
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    s: GameState,
    view: View,
    palette: Palette,
    sprites: SpriteCache,
  ): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, view.pxWidth, view.pxHeight);
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, view.offsetY);

    const l = layout(s, view);

    drawHero(ctx, s, l, palette, sprites);
    drawMob(ctx, s, l, palette, sprites);
    drawCompanion(ctx, s, l, palette, sprites);
    this.drawClicks(ctx, s, palette);
    // After the burst and the crow, so neither covers it.
    drawMobBar(ctx, s, l, palette);

    // Text in device pixels so it stays sharp at any scale.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawTexts(ctx, s, view, palette);
    drawIntro(ctx, s, view, palette);
  }

  private drawClicks(ctx: CanvasRenderingContext2D, s: GameState, p: Palette): void {
    this.clicks = this.clicks.filter(
      (c) => s.ticks >= c.born && seconds(s.ticks - c.born) < CLICK_LIFE,
    );
    ctx.fillStyle = p.fg;
    for (const c of this.clicks) {
      for (const dot of clickBurst(seconds(s.ticks - c.born) / CLICK_LIFE)) {
        ctx.fillRect(Math.round(c.x + dot.x), Math.round(c.y + dot.y), 1, 1);
      }
    }
  }

  private drawTexts(ctx: CanvasRenderingContext2D, s: GameState, v: View, p: Palette): void {
    this.texts = this.texts.filter(
      (t) => s.ticks >= t.born && seconds(s.ticks - t.born) < TEXT_LIFE,
    );
    const size = snapFontSize(v.scale * 5);
    for (const t of this.texts) {
      const age = seconds(s.ticks - t.born) / TEXT_LIFE;
      const y = t.y - TEXT_RISE * age;
      text(ctx, t.text, t.x * v.scale, y * v.scale + v.offsetY, size, p[t.color], p.bg);
    }
  }
}

export type Layout = {
  groundY: number;
  hero: SpriteDef;
  heroX: number;
  heroY: number;
  mob: SpriteDef;
  mobX: number;
  mobY: number;
};

export function layout(s: GameState, view: View): Layout {
  const groundY = view.height - GROUND;
  const hero = heroAnimations.idle;
  const mob = MOB_SPRITES[s.duel.mob.kind];
  // Side margin: ~12% of the width, but always leave a gap for the widest mob.
  const spare = view.width - hero.width - mobWidth();
  const edge = Math.max(
    COMPACT_MARGIN,
    Math.min(Math.round(view.width * 0.12), Math.floor(spare / 3)),
  );
  return {
    groundY,
    hero,
    heroX: edge,
    heroY: groundY - hero.height,
    mob,
    mobX: view.width - edge - mob.width,
    mobY: groundY - mob.height,
  };
}

function heroPose(s: GameState): { anim: HeroAnimation; frame: number } {
  const d = s.duel;
  const since = (tick: number | null) => (tick === null ? Infinity : seconds(d.tick - tick));
  const play = (anim: HeroAnimation, t: number, hold = false) => {
    const def = heroAnimations[anim];
    const f = Math.floor(t * (def.fps ?? 1));
    return { anim, frame: hold ? Math.min(f, def.frames.length - 1) : f };
  };
  // Priority: death > attack > hurt > idle.
  if (d.phase === 'heroDying') return play('death', seconds(d.tick - d.phaseTick), true);
  if (d.outcome === 'loss') return play('death', Infinity, true);
  const slash = heroAnimations.slash;
  const attackAge = since(d.heroAttackTick);
  if (attackAge < slash.frames.length / (slash.fps ?? 1)) return play('slash', attackAge);
  const hurt = heroAnimations.hurt;
  const hurtAge = since(d.heroHurtTick);
  if (hurtAge < hurt.frames.length / (hurt.fps ?? 1)) return play('hurt', hurtAge);
  return { anim: 'idle', frame: frameAt(heroAnimations.idle, seconds(s.ticks)) };
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  l: Layout,
  p: Palette,
  sprites: SpriteCache,
): void {
  const d = s.duel;
  const { anim, frame } = heroPose(s);
  const def = heroAnimations[anim];
  const alive = d.outcome !== 'loss' && d.phase !== 'heroDying';
  const flash = alive && d.heroHurtTick !== null && seconds(d.tick - d.heroHurtTick) < FLASH;
  const x = l.heroX - (flash ? 1 : 0);
  const y = l.groundY - def.height;

  ctx.drawImage(flash ? sprites.tint(def, frame, p.red) : sprites.frame(def, frame), x, y);

  const anchor = heroWeaponAnchors[anim][frame];
  if (anchor) {
    const pose = weapons[s.equipped].poses[anchor.pose];
    // Clip at the ground so a planted blade reads as stuck in the ground.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, l.mobX + l.mob.width, l.groundY);
    ctx.clip();
    ctx.drawImage(
      sprites.frame(pose.sprite, 0),
      x + anchor.x - pose.grip.x,
      y + anchor.y - pose.grip.y,
    );
    ctx.restore();
  }

  if (anim === 'slash' && weaponAttack(s.equipped).effect === 'slashArc') {
    const arcFrame = slashArcFrames[frame];
    const arc = slashArcs[s.equipped];
    if (arcFrame !== null && arcFrame !== undefined && arc) {
      ctx.drawImage(sprites.frame(arc, arcFrame), x + slashArcOffset.x, y + slashArcOffset.y);
    }
  }
}

function drawMob(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  l: Layout,
  p: Palette,
  sprites: SpriteCache,
): void {
  const d = s.duel;
  if (d.outcome === 'win' && d.phase !== 'mobDying') return;
  const def = l.mob;
  const frame = frameAt(def, seconds(s.ticks) * 0.5);
  let x = l.mobX;

  if (d.phase === 'mobDying') {
    // Blink out.
    const age = seconds(d.tick - d.phaseTick);
    if (age > 0.8 || Math.floor(age * 10) % 2 === 1) return;
    ctx.drawImage(sprites.tint(def, frame, p.red), x, l.mobY);
    return;
  }

  if (d.mobAttackTick !== null) {
    const w = MOB_KINDS[d.mob.kind].windup;
    const age = seconds(d.tick - d.mobAttackTick);
    const t = age < w ? age / w : Math.max(0, 1 - (age - w) / MOB_LUNGE_BACK);
    x -= Math.round(MOB_LUNGE * t);
  }
  const flash = d.mobHurtTick !== null && seconds(d.tick - d.mobHurtTick) < FLASH;
  if (flash) x += 2;
  ctx.drawImage(flash ? sprites.tint(def, frame, p.red) : sprites.frame(def, frame), x, l.mobY);
}

/** HP bar above the mob, while it's alive. */
function drawMobBar(ctx: CanvasRenderingContext2D, s: GameState, l: Layout, p: Palette): void {
  const d = s.duel;
  if (d.outcome === 'win' || d.phase === 'mobDying') return;
  const def = l.mob;
  const barW = def.width;
  const barY = l.mobY - 6;
  const ratio = d.mob.maxHp > 0 ? d.mob.hp / d.mob.maxHp : 0;
  ctx.fillStyle = p.fg;
  ctx.fillRect(l.mobX, barY, barW, 4);
  ctx.fillStyle = p.bg;
  ctx.fillRect(l.mobX + 1, barY + 1, barW - 2, 2);
  ctx.fillStyle = ratio < 0.3 ? p.red : p.green;
  ctx.fillRect(l.mobX + 1, barY + 1, Math.ceil((barW - 2) * ratio), 2);
}

/**
 * Eight pixels on a ring that grows and thins out over `t` (0..1): the click
 * burst, as offsets in art pixels from the pointer.
 */
export function clickBurst(t: number): { x: number; y: number }[] {
  const r = CLICK_RADIUS.from + (CLICK_RADIUS.to - CLICK_RADIUS.from) * t;
  // Diagonals drop out in the second half so the burst fades without alpha.
  const count = t < 0.5 ? 8 : 4;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    dots.push({ x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) });
  }
  return dots;
}

export type CompanionPose = {
  anim: CompanionAnimation;
  frame: number;
  /** Top-left of the companion frame, in art pixels. */
  x: number;
  y: number;
  /** Top-left of the hit effect and its frame, while it shows. */
  effect: { x: number; y: number; frame: number } | null;
};

/**
 * Companion pose: perched on the hero's hat, or the attack flight (fly out,
 * peck so the hit frame lands with the damage, fly back). Pure, for tests.
 */
export function companionPose(s: GameState, l: Layout): CompanionPose | null {
  const def = companionDef(s);
  const set = def && COMPANION_SPRITES[def.sprites];
  if (!def || !set) return null;
  const { idle, flyOut, peck, flyBack } = set.animations;
  const perchX = l.heroX + PERCH.x - Math.floor(idle.width / 2);
  const perchY = l.heroY + PERCH.y - idle.height;
  const perched: CompanionPose = {
    anim: 'idle',
    frame: frameAt(idle, seconds(s.ticks)),
    x: perchX,
    y: perchY,
    effect: null,
  };
  const d = s.duel;
  if (d.companionAttackTick === null) return perched;

  const age = seconds(d.tick - d.companionAttackTick);
  const peckFps = peck.fps ?? 1;
  const out = windup(def.attack); // damage lands here
  const peckStart = out - set.hitFrame / peckFps;
  const backStart = out + 1 / peckFps; // the hit frame's length
  if (age >= backStart + PECK_BACK) return perched;

  // Beak tip on the mob's front, about a third down.
  const targetX = l.mobX - set.hitPoint.x;
  const targetY = Math.max(0, l.mobY + Math.round(l.mob.height * 0.3) - set.hitPoint.y);
  const t = age < out ? age / out : age < backStart ? 1 : 1 - (age - backStart) / PECK_BACK;
  const x = Math.round(perchX + (targetX - perchX) * t);
  const y = Math.round(perchY + (targetY - perchY) * t - Math.sin(Math.PI * t) * FLIGHT_ARC);

  const fx = set.hitEffect;
  const fxAge = age - out;
  const fxFrame = Math.floor(fxAge * (fx.fps ?? 1));
  const effect =
    fxAge >= 0 && fxFrame < fx.frames.length
      ? {
          x: targetX + set.hitPoint.x - Math.floor(fx.width / 2),
          y: targetY + set.hitPoint.y - Math.floor(fx.height / 2),
          frame: fxFrame,
        }
      : null;

  if (age < peckStart) return { anim: 'flyOut', frame: frameAt(flyOut, age), x, y, effect };
  if (age < backStart) {
    const frame = Math.min(peck.frames.length - 1, Math.floor((age - peckStart) * peckFps));
    return { anim: 'peck', frame, x, y, effect };
  }
  return { anim: 'flyBack', frame: frameAt(flyBack, age - backStart), x, y, effect };
}

function drawCompanion(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  l: Layout,
  p: Palette,
  sprites: SpriteCache,
): void {
  const pose = companionPose(s, l);
  const set = pose && COMPANION_SPRITES[companionDef(s)!.sprites];
  if (!pose || !set) return;
  const def = set.animations[pose.anim];
  // A 1px bg outline so the ink crow reads against the ink hat (like the hero's arm).
  const outline = sprites.tint(def, pose.frame, p.bg);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    ctx.drawImage(outline, pose.x + dx, pose.y + dy);
  }
  ctx.drawImage(sprites.frame(def, pose.frame), pose.x, pose.y);
  if (pose.effect) {
    ctx.drawImage(sprites.frame(set.hitEffect, pose.effect.frame), pose.effect.x, pose.effect.y);
  }
}

/** Stage banner, only on full intros (a new stage, or the first duel after Start). */
function drawIntro(ctx: CanvasRenderingContext2D, s: GameState, v: View, p: Palette): void {
  const d = s.duel;
  if (d.phase !== 'intro' || d.introTicks < secToTicks(DUEL.intro)) return;
  // Gone just before the first swing starts.
  if (seconds(d.tick) >= seconds(d.introTicks) - windup(weaponAttack(s.equipped)) - 0.2) return;
  const label = `${isBoss(s.stage) ? 'BOSS' : 'STAGE'} ${s.world}.${s.stage}`;
  const size = snapFontSize(Math.max(22, v.scale * 7));
  const y = v.offsetY + (v.height - GROUND) * v.scale * 0.3;
  text(ctx, label, v.pxWidth / 2, y, size, isBoss(s.stage) ? p.purple : p.fg, p.bg);
}

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  outline: string,
): void {
  ctx.font = `bold ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Math.round(size / 6));
  ctx.strokeStyle = outline;
  ctx.strokeText(str, Math.round(x), Math.round(y));
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}
