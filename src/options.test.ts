import { describe, expect, it } from "vitest";
import { resolveOptions } from "./options";

describe("resolveOptions", () => {
  it("fills defaults", () => {
    expect(resolveOptions({}, "")).toEqual({ saveKey: "afk-game", theme: "auto", debug: false });
  });

  it("turns debug on from ?afkdebug", () => {
    expect(resolveOptions({}, "?afkdebug").debug).toBe(true);
    expect(resolveOptions({}, "?x=1&afkdebug=1").debug).toBe(true);
  });

  it("keeps given values", () => {
    expect(resolveOptions({ saveKey: "s", theme: "light", debug: true }, "")).toEqual({
      saveKey: "s",
      theme: "light",
      debug: true,
    });
  });
});
