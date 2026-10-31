import { describe, expect, it } from "vitest";
import { createState, update } from "./state";

describe("update", () => {
  it("advances time without mutating the input", () => {
    const s0 = createState();
    const s1 = update(s0, 0.5);
    expect(s0).toEqual({ time: 0, ticks: 0 });
    expect(s1).toEqual({ time: 0.5, ticks: 1 });
  });
});
