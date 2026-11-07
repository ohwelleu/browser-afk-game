/**
 * Share links: the save string rides in the URL hash (`#save=AFK1.…`). The
 * hash is never sent to the server, so the save stays on the player's device.
 */

const PARAM = 'save';

const hashParams = (hash: string) => new URLSearchParams(hash.replace(/^#/, ''));

/** `href` with its hash replaced by `#save=<save>`. */
export function buildSaveLink(href: string, save: string): string {
  const url = new URL(href);
  url.hash = `${PARAM}=${save}`;
  return url.href;
}

/** The save string in a `#save=…` hash, or null when there is none. */
export function readSaveHash(hash: string): string | null {
  const save = hashParams(hash).get(PARAM)?.trim();
  return save ? save : null;
}

/** `href` without the `save` hash param (other hash params stay). */
export function stripSaveHash(href: string): string {
  const url = new URL(href);
  const params = hashParams(url.hash);
  params.delete(PARAM);
  const rest = params.toString();
  url.hash = rest;
  // `url.hash = ''` keeps a bare `#`; drop it so the URL looks untouched.
  return rest ? url.href : url.href.replace(/#$/, '');
}

type LocationLike = Pick<Location, 'href' | 'hash'>;
type HistoryLike = Pick<History, 'replaceState' | 'state'>;

/**
 * Boot hook: the save string from the page's `#save=` hash (or null) and a
 * `done` that removes it from the URL, without a reload or a history entry,
 * so reloading doesn't offer the import again.
 */
export function takeSaveLink(
  loc: LocationLike,
  hist: HistoryLike,
): { save: string; done(): void } | null {
  const save = readSaveHash(loc.hash);
  if (!save) return null;
  return {
    save,
    done() {
      if (readSaveHash(loc.hash)) hist.replaceState(hist.state, '', stripSaveHash(loc.href));
    },
  };
}
