/**
 * One-tab guard: only one tab (per save key) runs the game and writes the
 * save. Others show "open in another tab" until the player takes over.
 *
 * The owner writes a heartbeat `{ id, at }` under `<saveKey>.tab` every
 * second. A tab that starts while a fresh heartbeat from another tab exists
 * is not the owner. A heartbeat older than `STALE_MS` (closed or crashed
 * tab) is ignored. Takeovers are announced on a BroadcastChannel; where
 * that's missing, the `storage` event on the heartbeat key does the same.
 */

export const HEARTBEAT_MS = 1000;
export const STALE_MS = 5000;

type Msg = { type: 'claim'; id: string };

export type ChannelLike = {
  postMessage(msg: Msg): void;
  addEventListener(type: 'message', fn: (e: { data: unknown }) => void): void;
  close(): void;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type TabGuardDeps = {
  storage?: StorageLike;
  /** Omit to rely on the `storage` event only. */
  channel?: ChannelLike;
  /** Subscribes to `storage` events; returns an unsubscribe function. */
  onStorage?: (fn: (key: string | null, newValue: string | null) => void) => () => void;
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  id?: string;
};

export type TabGuard = {
  readonly owner: boolean;
  /** Become the owner ("Play here"). */
  claim(): void;
  /** Called with the new value whenever `owner` changes. */
  onChange(fn: (owner: boolean) => void): void;
  /**
   * Frees the slot (page unload). Keeps running: if the page comes back
   * (back/forward cache), the next heartbeat re-checks who owns the game.
   */
  release(): void;
  /** Stops the heartbeat and frees the slot for other tabs. */
  destroy(): void;
};

type Beat = { id: string; at: number };

export const heartbeatKey = (saveKey: string) => `${saveKey}.tab`;

function readBeat(storage: StorageLike | undefined, key: string): Beat | null {
  try {
    const v = JSON.parse(storage?.getItem(key) ?? 'null') as Partial<Beat> | null;
    return v && typeof v.id === 'string' && typeof v.at === 'number' ? (v as Beat) : null;
  } catch {
    return null;
  }
}

export function createTabGuard(saveKey: string, deps: TabGuardDeps = {}): TabGuard {
  const {
    storage,
    channel,
    onStorage,
    now = Date.now,
    setInterval: setTimer = (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: clearTimer = (h) => globalThis.clearInterval(h as number),
    id = Math.random().toString(36).slice(2) + now().toString(36),
  } = deps;
  const key = heartbeatKey(saveKey);
  const listeners: ((owner: boolean) => void)[] = [];
  let owner = false;

  const otherLive = (b: Beat | null) => b !== null && b.id !== id && now() - b.at < STALE_MS;

  function write(): void {
    try {
      storage?.setItem(key, JSON.stringify({ id, at: now() }));
    } catch {
      // Storage full or blocked: the channel still announces takeovers.
    }
  }

  function set(next: boolean): void {
    if (next === owner) return;
    owner = next;
    for (const fn of listeners) fn(owner);
  }

  function claim(): void {
    write();
    channel?.postMessage({ type: 'claim', id });
    set(true);
  }

  function release(): void {
    if (!owner || readBeat(storage, key)?.id !== id) return;
    try {
      storage?.removeItem(key);
    } catch {
      // ignore
    }
  }

  function tick(): void {
    if (!owner) return;
    // Another tab wrote its heartbeat (a missed message or a race): yield.
    if (otherLive(readBeat(storage, key))) set(false);
    else write();
  }

  channel?.addEventListener('message', (e) => {
    const m = e.data as Partial<Msg> | null;
    if (m?.type === 'claim' && m.id !== id) set(false);
  });
  const unsubscribe = onStorage?.((k, value) => {
    if (k !== key || !owner || value === null) return;
    let beat: Beat | null = null;
    try {
      beat = JSON.parse(value) as Beat;
    } catch {
      return;
    }
    if (beat && beat.id !== id) set(false);
  });

  if (otherLive(readBeat(storage, key))) owner = false;
  else claim();
  const timer = setTimer(tick, HEARTBEAT_MS);

  return {
    get owner() {
      return owner;
    },
    claim,
    onChange(fn) {
      listeners.push(fn);
    },
    release,
    destroy() {
      clearTimer(timer);
      unsubscribe?.();
      release();
      channel?.close();
      listeners.length = 0;
    },
  };
}

/** The guard with the real browser APIs. */
export function createBrowserTabGuard(saveKey: string, storage?: StorageLike): TabGuard {
  const channel =
    typeof BroadcastChannel === 'function'
      ? (new BroadcastChannel(`afk-game:${saveKey}`) as unknown as ChannelLike)
      : undefined;
  const guard = createTabGuard(saveKey, {
    storage,
    channel,
    onStorage(fn) {
      const handler = (e: StorageEvent) => fn(e.key, e.newValue);
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  });
  // A reload must not find its own old heartbeat and lock itself out.
  const onPageHide = () => guard.release();
  window.addEventListener('pagehide', onPageHide);
  return {
    get owner() {
      return guard.owner;
    },
    claim: guard.claim,
    onChange: guard.onChange,
    release: guard.release,
    destroy() {
      window.removeEventListener('pagehide', onPageHide);
      guard.destroy();
    },
  };
}

/** The "open in another tab" overlay (markup lives in game.ts). */
export const TAB_LOCK_STYLES = `
.tab-lock {
  z-index: 10;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  text-align: center;
  background: var(--_bg);
}
.tab-lock p {
  margin: 0;
  padding: 12px 16px;
  border: 3px solid var(--_fg);
}
`;
