import type { GameOptions } from "./game";
import { DEFAULT_SAVE_KEY } from "./save";
import { parseThemeMode } from "./theme";

export type MountOptions = {
  saveKey?: string;
  theme?: string;
  debug?: boolean;
};

/** Fills defaults. `?afkdebug` in the page URL turns debug on too. */
export function resolveOptions(opts: MountOptions, search: string): GameOptions {
  return {
    saveKey: opts.saveKey || DEFAULT_SAVE_KEY,
    theme: parseThemeMode(opts.theme),
    debug: Boolean(opts.debug) || new URLSearchParams(search).has("afkdebug"),
  };
}
