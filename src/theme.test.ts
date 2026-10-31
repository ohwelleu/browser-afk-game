import { describe, expect, it } from "vitest";
import { buildPalette, DEFAULT_PALETTES, parseThemeMode, resolveTheme } from "./theme";

const classes = (...names: string[]) => ({ contains: (t: string) => names.includes(t) });

describe("parseThemeMode", () => {
  it("accepts dark/light and falls back to auto", () => {
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("auto")).toBe("auto");
    expect(parseThemeMode("purple")).toBe("auto");
    expect(parseThemeMode(null)).toBe("auto");
  });
});

describe("resolveTheme", () => {
  it("uses an explicit mode as is", () => {
    expect(resolveTheme("light", classes("dark"), true)).toBe("light");
    expect(resolveTheme("dark", classes(), false)).toBe("dark");
  });

  it("auto: html class wins over prefers-color-scheme", () => {
    expect(resolveTheme("auto", classes("dark"), false)).toBe("dark");
    expect(resolveTheme("auto", classes("light"), true)).toBe("light");
  });

  it("auto: falls back to prefers-color-scheme", () => {
    expect(resolveTheme("auto", classes(), true)).toBe("dark");
    expect(resolveTheme("auto", classes(), false)).toBe("light");
  });
});

describe("buildPalette", () => {
  it("swaps base colours between themes", () => {
    expect(DEFAULT_PALETTES.dark.bg).toBe("#1f1f1f");
    expect(DEFAULT_PALETTES.dark.fg).toBe("#ece9e2");
    expect(DEFAULT_PALETTES.light.bg).toBe("#ece9e2");
    expect(DEFAULT_PALETTES.light.fg).toBe("#1f1f1f");
  });

  it("applies --afk-* overrides", () => {
    const vars: Record<string, string> = { "--afk-bg": " #000 ", "--afk-pink": "hotpink" };
    const p = buildPalette("dark", (name) => vars[name] ?? "");
    expect(p.bg).toBe("#000");
    expect(p.pink).toBe("hotpink");
    expect(p.fg).toBe(DEFAULT_PALETTES.dark.fg);
  });
});
