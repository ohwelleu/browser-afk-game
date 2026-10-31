export type ThemeMode = 'dark' | 'light' | 'auto';
export type Theme = 'dark' | 'light';

export const COLOR_NAMES = ['orange', 'yellow', 'red', 'purple', 'green', 'blue', 'pink'] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export type Palette = { bg: string; fg: string } & Record<ColorName, string>;

export const DEFAULT_PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: '#1f1f1f',
    fg: '#ece9e2',
    orange: '#ff7a1a',
    yellow: '#facc15',
    red: '#ef4444',
    purple: '#9b6bff',
    green: '#22c55e',
    blue: '#4f8bff',
    pink: '#f472b6',
  },
  light: {
    bg: '#ece9e2',
    fg: '#1f1f1f',
    orange: '#ff6b00',
    yellow: '#eab308',
    red: '#dc2626',
    purple: '#7c3aed',
    green: '#16a34a',
    blue: '#2563eb',
    pink: '#db2777',
  },
};

export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return value === 'dark' || value === 'light' ? value : 'auto';
}

/**
 * `auto` follows the host page: an explicit `dark` / `light` class on
 * `<html>` wins, otherwise `prefers-color-scheme`.
 */
export function resolveTheme(
  mode: ThemeMode,
  htmlClasses: { contains(token: string): boolean },
  prefersDark: boolean,
): Theme {
  if (mode !== 'auto') return mode;
  if (htmlClasses.contains('dark')) return 'dark';
  if (htmlClasses.contains('light')) return 'light';
  return prefersDark ? 'dark' : 'light';
}

/**
 * Theme defaults, with any `--afk-<name>` CSS custom property set by the host
 * taking precedence.
 */
export function buildPalette(theme: Theme, readVar: (name: string) => string): Palette {
  const palette = { ...DEFAULT_PALETTES[theme] };
  for (const key of Object.keys(palette) as (keyof Palette)[]) {
    const override = readVar(`--afk-${key}`).trim();
    if (override) palette[key] = override;
  }
  return palette;
}
