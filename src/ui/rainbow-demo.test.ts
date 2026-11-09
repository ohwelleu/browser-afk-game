import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RAINBOW_DEMO_HTML, RAINBOW_DEMO_STYLES, mountRainbowDemo } from './rainbow-demo';
import { RAINBOW_STYLES } from './rainbow';

// The project has no DOM library, so the section is stood in by tiny fakes.
type Listener = () => void;
class FakeEl {
  textContent = '';
  value = '20';
  open = false;
  checked = false;
  style = { color: '', setProperty: vi.fn() };
  classes = new Set<string>();
  classList = {
    toggle: (name: string, on: boolean) =>
      void (on ? this.classes.add(name) : this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
  };
  listeners = new Map<string, Listener[]>();
  addEventListener = (type: string, fn: Listener) =>
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  removeEventListener = (type: string, fn: Listener) =>
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== fn),
    );
  fire(type: string): void {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
  getContext = () => null;
}

const SELECTORS = {
  details: '.dbg-rainbow',
  slider: '[name="rainbow-speed"]',
  secs: '.dbg-rainbow-secs',
  js: '.dbg-rainbow-js b',
  canvas: '.dbg-rainbow canvas',
  respect: '[name="rainbow-respect"]',
  note: '.dbg-rainbow-note',
} as const;

function setup(systemReduced: boolean) {
  const els = Object.fromEntries(Object.keys(SELECTORS).map((k) => [k, new FakeEl()])) as Record<
    keyof typeof SELECTORS,
    FakeEl
  >;
  const bySelector = new Map<string, FakeEl>(
    (Object.keys(SELECTORS) as (keyof typeof SELECTORS)[]).map((k) => [SELECTORS[k], els[k]]),
  );
  const root = { querySelector: (sel: string) => bySelector.get(sel) ?? null };
  const media = new FakeEl() as FakeEl & { matches: boolean };
  media.matches = systemReduced;
  vi.stubGlobal('matchMedia', () => media);
  const raf = vi.fn(() => 1);
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
  const stop = mountRainbowDemo(root as unknown as HTMLElement);
  return { els, media, raf, stop };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('demo markup and styles', () => {
  it('has the "Respect reduced motion" checkbox, unticked by default', () => {
    expect(RAINBOW_DEMO_HTML).toMatch(
      /<input type="checkbox" name="rainbow-respect" \/> Respect reduced motion/,
    );
    expect(RAINBOW_DEMO_HTML).not.toMatch(/name="rainbow-respect"[^>]*checked/);
  });

  it('re-enables the flow for every rainbow form, only under .dbg-rainbow.dbg-rainbow-motion', () => {
    const rule = /(\.dbg-rainbow\.dbg-rainbow-motion [^{]+,\s*)+[^{]+\{[^}]*\}/.exec(
      RAINBOW_DEMO_STYLES,
    );
    expect(rule).not.toBeNull();
    for (const sel of [
      '.rainbow',
      '.rainbow-fill',
      '.rainbow-frame::before',
      '.rainbow-glow::after',
    ]) {
      expect(rule![0]).toContain(`.dbg-rainbow.dbg-rainbow-motion ${sel}`);
    }
    expect(rule![0]).toMatch(/animation: afk-rainbow-flow var\(--afk-rainbow-period, 20s\)/);
    expect(rule![0]).toContain('background-position');
  });

  it('comes after the game rules, so the override wins', () => {
    expect(RAINBOW_DEMO_STYLES.startsWith(RAINBOW_STYLES)).toBe(true);
  });
});

describe('mountRainbowDemo: system prefers reduced motion', () => {
  it('overrides it by default: motion class on, animating, note says so', () => {
    const { els, raf } = setup(true);
    els.details.open = true;
    els.details.fire('toggle');
    expect(els.details.classList.contains('dbg-rainbow-motion')).toBe(true);
    expect(els.note.textContent).toBe(
      'System prefers reduced motion. Demo overrides it: animating.',
    );
    expect(raf).toHaveBeenCalled();
  });

  it('respects it when the checkbox is ticked: no class, still, note says so', () => {
    const { els, raf } = setup(true);
    els.details.open = true;
    els.details.fire('toggle');
    raf.mockClear();
    els.respect.checked = true;
    els.respect.fire('change');
    expect(els.details.classList.contains('dbg-rainbow-motion')).toBe(false);
    expect(els.note.textContent).toBe(
      'System prefers reduced motion. Respected: animation is off.',
    );
    expect(raf).not.toHaveBeenCalled();
    expect(els.js.textContent).toMatch(/^hsl\(0, /); // drawn once at t = 0
  });

  it('goes back to animating when the checkbox is unticked again', () => {
    const { els, raf } = setup(true);
    els.details.open = true;
    els.respect.checked = true;
    els.respect.fire('change');
    raf.mockClear();
    els.respect.checked = false;
    els.respect.fire('change');
    expect(els.details.classList.contains('dbg-rainbow-motion')).toBe(true);
    expect(raf).toHaveBeenCalled();
  });
});

describe('mountRainbowDemo: system has no reduced motion', () => {
  it('animates and says the system is not reduced, whatever the checkbox', () => {
    const { els, raf } = setup(false);
    els.details.open = true;
    els.details.fire('toggle');
    expect(els.note.textContent).toBe('System: reduced motion is off. Animating.');
    expect(raf).toHaveBeenCalled();
    raf.mockClear();
    els.respect.checked = true;
    els.respect.fire('change');
    expect(els.note.textContent).toBe('System: reduced motion is off. Animating.');
    expect(raf).toHaveBeenCalled();
  });
});

describe('mountRainbowDemo: system setting changes live', () => {
  it('updates the note when the media query changes', () => {
    const { els, media } = setup(false);
    media.matches = true;
    media.fire('change');
    expect(els.note.textContent).toContain('Demo overrides it');
  });

  it('stops listening after the returned stop function', () => {
    const { els, media, stop } = setup(true);
    stop();
    els.respect.checked = true;
    els.respect.fire('change');
    media.fire('change');
    expect(els.note.textContent).toContain('Demo overrides it');
  });
});
