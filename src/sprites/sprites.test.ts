import { describe, expect, it } from "vitest";
import * as S from "./index";
import type { SpriteDef, WeaponDef } from "./types";
import { validateAnchors, validateSprite, validateWeapon } from "./validate";

const exported = Object.values(S as Record<string, unknown>);
const sprites = exported.filter(
  (v): v is SpriteDef => typeof v === "object" && v !== null && "frames" in v,
);
const weapons = exported.filter(
  (v): v is WeaponDef => typeof v === "object" && v !== null && "poses" in v,
);

describe("sprites", () => {
  it.each(sprites.map((s) => [s.name, s] as const))("%s has valid rows and chars", (_, s) => {
    expect(validateSprite(s)).toEqual([]);
  });

  it.each(weapons.map((w) => [w.name, w] as const))("%s poses are valid", (_, w) => {
    expect(validateWeapon(w)).toEqual([]);
  });

  it("weapons cover every tier in order", () => {
    expect(S.weapons.map((w) => w.tier)).toEqual(S.weapons.map((_, i) => i));
  });

  it("every hero animation has one weapon anchor per frame", () => {
    const hero = sprites.filter((s) => s.name.startsWith("hero-"));
    expect(hero.length).toBeGreaterThan(0);
    for (const s of hero) {
      expect(validateAnchors(s, S.heroWeaponAnchors[s.name.slice("hero-".length)])).toEqual([]);
    }
  });

  it("slash arcs: one per tier, same size, frame map matches heroSlash", () => {
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

  it("hero holds the weapon in front on every frame", () => {
    for (const list of Object.values(S.heroWeaponAnchors)) {
      for (const a of list) expect(a?.behind ?? false).toBe(false);
    }
  });

  it("validator rejects broken sprites", () => {
    const bad: SpriteDef = { name: "bad", width: 3, height: 2, frames: [["##", "#x#", "###"]] };
    expect(validateSprite(bad)).toEqual([
      "bad: frame 0: 3 rows, expected 2",
      "bad: frame 0 row 0: 2 chars, expected 3",
      'bad: frame 0 row 1 col 1: bad char "x"',
    ]);
  });

  it("sprite names are unique", () => {
    const names = [
      ...sprites,
      ...weapons.flatMap((w) => Object.values(w.poses).map((p) => p.sprite)),
    ].map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
