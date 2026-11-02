import { describe, expect, it } from 'vitest';
import {
  createTabGuard,
  heartbeatKey,
  HEARTBEAT_MS,
  STALE_MS,
  type ChannelLike,
  type TabGuardDeps,
} from './tab-guard';

const KEY = 'afk-save';

/** Shared world for several fake tabs: one storage, one clock, one channel bus. */
function world(opts: { channel?: boolean } = {}) {
  const data = new Map<string, string>();
  let time = 1_000_000;
  const timers: { fn: () => void; tab: number }[] = [];
  const channels: { tab: number; fns: ((e: { data: unknown }) => void)[] }[] = [];
  const storageSubs: { tab: number; fn: (k: string | null, v: string | null) => void }[] = [];
  let nextTab = 0;

  function tab(id: string, extra: Partial<TabGuardDeps> = {}) {
    const t = nextTab++;
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem(k: string, v: string) {
        data.set(k, v);
        // Like the browser: other tabs get a `storage` event.
        for (const s of storageSubs) if (s.tab !== t) s.fn(k, v);
      },
      removeItem(k: string) {
        data.delete(k);
        for (const s of storageSubs) if (s.tab !== t) s.fn(k, null);
      },
    };
    let channel: ChannelLike | undefined;
    if (opts.channel !== false) {
      const entry = { tab: t, fns: [] as ((e: { data: unknown }) => void)[] };
      channels.push(entry);
      channel = {
        postMessage(msg) {
          for (const c of channels) if (c.tab !== t) for (const fn of c.fns) fn({ data: msg });
        },
        addEventListener: (_type, fn) => entry.fns.push(fn),
        close: () => channels.splice(channels.indexOf(entry), 1),
      };
    }
    return createTabGuard(KEY, {
      id,
      storage,
      channel,
      onStorage(fn) {
        const sub = { tab: t, fn };
        storageSubs.push(sub);
        return () => storageSubs.splice(storageSubs.indexOf(sub), 1);
      },
      now: () => time,
      setInterval(fn) {
        const timer = { fn, tab: t };
        timers.push(timer);
        return timer;
      },
      clearInterval: (h) => timers.splice(timers.indexOf(h as (typeof timers)[0]), 1),
      ...extra,
    });
  }

  return {
    data,
    tab,
    /** Moves the clock; `only` runs just those tabs' heartbeats (others are frozen/closed). */
    advance(ms: number, only?: number[]) {
      for (let left = ms; left > 0; left -= HEARTBEAT_MS) {
        time += Math.min(HEARTBEAT_MS, left);
        for (const t of [...timers]) if (!only || only.includes(t.tab)) t.fn();
      }
    },
  };
}

describe.each([
  ['BroadcastChannel', true],
  ['storage event fallback', false],
])('tab guard (%s)', (_name, channel) => {
  it('the first tab owns the game', () => {
    const w = world({ channel });
    const a = w.tab('a');
    expect(a.owner).toBe(true);
    expect(JSON.parse(w.data.get(heartbeatKey(KEY))!).id).toBe('a');
  });

  it('a second tab is blocked while the first one is alive', () => {
    const w = world({ channel });
    const a = w.tab('a');
    const b = w.tab('b');
    w.advance(10_000);
    expect(a.owner).toBe(true);
    expect(b.owner).toBe(false);
  });

  it('"Play here" takes over and the old tab is told', () => {
    const w = world({ channel });
    const a = w.tab('a');
    const b = w.tab('b');
    const changes: boolean[] = [];
    a.onChange((o) => changes.push(o));
    b.claim();
    expect(b.owner).toBe(true);
    expect(a.owner).toBe(false);
    expect(changes).toEqual([false]);
    w.advance(10_000);
    expect(a.owner).toBe(false);
    expect(b.owner).toBe(true);
    // And back again.
    a.claim();
    expect(a.owner).toBe(true);
    expect(b.owner).toBe(false);
  });

  it('a stale heartbeat (crashed tab) does not block', () => {
    const w = world({ channel });
    w.tab('a');
    w.advance(STALE_MS + HEARTBEAT_MS, []); // tab a is frozen / gone
    expect(w.tab('b').owner).toBe(true);
  });

  it('release (page unload) frees the slot; a restored page re-checks', () => {
    const w = world({ channel });
    const a = w.tab('a');
    a.release();
    expect(w.data.has(heartbeatKey(KEY))).toBe(false);
    const b = w.tab('b');
    expect(b.owner).toBe(true);
    w.advance(HEARTBEAT_MS * 2);
    expect(a.owner).toBe(false);
    expect(b.owner).toBe(true);
  });

  it('closing the owner frees the slot at once', () => {
    const w = world({ channel });
    w.tab('a').destroy();
    expect(w.data.has(heartbeatKey(KEY))).toBe(false);
    expect(w.tab('b').owner).toBe(true);
  });
});

describe('tab guard edge cases', () => {
  it('two tabs that both claimed settle on one owner', () => {
    const w = world({ channel: false });
    // Both started with no heartbeat visible to the other (no storage events).
    const a = w.tab('a', { onStorage: undefined });
    w.data.delete(heartbeatKey(KEY));
    const b = w.tab('b', { onStorage: undefined });
    expect(a.owner && b.owner).toBe(true);
    w.advance(HEARTBEAT_MS * 2);
    expect([a.owner, b.owner].filter(Boolean)).toHaveLength(1);
  });

  it('works without storage (always the owner)', () => {
    const g = createTabGuard(KEY, { setInterval: () => 0, clearInterval: () => {} });
    expect(g.owner).toBe(true);
    g.destroy();
  });

  it('ignores a broken heartbeat value', () => {
    const w = world();
    w.data.set(heartbeatKey(KEY), '{not json');
    expect(w.tab('a').owner).toBe(true);
  });
});
