import { describe, expect, it } from "vitest";
import { computeView, SCENE_HEIGHT } from "./view";

describe("computeView", () => {
  it("picks the largest whole-number scale that fits the height", () => {
    expect(computeView(800, 160, 1).scale).toBe(2);
    expect(computeView(800, 160, 2).scale).toBe(4);
    expect(computeView(800, 200, 1).scale).toBe(2);
  });

  it("never goes below 1x", () => {
    expect(computeView(100, 20, 1).scale).toBe(1);
  });

  it("sizes the backing store in device pixels and pins the scene to the bottom", () => {
    const v = computeView(801, 170, 1.5);
    expect(v.pxWidth).toBe(1202);
    expect(v.pxHeight).toBe(255);
    expect(v.scale).toBe(3);
    expect(v.width).toBe(Math.ceil(1202 / 3));
    expect(v.offsetY).toBe(255 - SCENE_HEIGHT * 3);
  });
});
