import { describe, expect, it, vi } from 'vitest';
import { RAIN_LINES_PER_ITEM, RAIN_MAX_LINES } from '../game/rain';
import { mountRainDemo, rainPreviewCounts, RAIN_DEMO_HTML } from './rain-demo';

// No DOM library in the project: the section is stood in by tiny fakes.
class FakeInput {
  value = '';
  checked = false;
  textContent = '';
  listeners: (() => void)[] = [];
  addEventListener = (_: string, fn: () => void) => void this.listeners.push(fn);
  fire = () => this.listeners.forEach((fn) => fn());
}

function mount() {
  const els: Record<string, FakeInput> = {
    '[name="rain-on"]': new FakeInput(),
    '[name="rain-rainbow"]': Object.assign(new FakeInput(), { value: '2' }),
    '[name="rain-yellow"]': Object.assign(new FakeInput(), { value: '2' }),
    '.dbg-rain-note': new FakeInput(),
  };
  const root = { querySelector: (sel: string) => els[sel] } as unknown as HTMLElement;
  const onChange = vi.fn();
  mountRainDemo(root, onChange);
  return { els, onChange };
}

describe('rain preview', () => {
  it('is off by default and does not touch the game on mount', () => {
    expect(RAIN_DEMO_HTML).not.toMatch(/name="rain-on"[^>]*checked/);
    const { onChange, els } = mount();
    expect(onChange).not.toHaveBeenCalled();
    expect(els['.dbg-rain-note'].textContent).toMatch(/^Off/);
  });

  it('previews 5 lines per typed item once switched on, and goes back to items when off', () => {
    const { els, onChange } = mount();
    els['[name="rain-on"]'].checked = true;
    els['[name="rain-on"]'].fire();
    expect(onChange).toHaveBeenLastCalledWith({ rainbow: 10, yellow: 10 });
    expect(els['.dbg-rain-note'].textContent).toContain('10 rainbow + 10 gold lines');
    els['[name="rain-yellow"]'].value = '30';
    els['[name="rain-yellow"]'].fire();
    expect(onChange).toHaveBeenLastCalledWith({ rainbow: 10, yellow: RAIN_MAX_LINES - 10 });
    els['[name="rain-on"]'].checked = false;
    els['[name="rain-on"]'].fire();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('rainPreviewCounts: null while off, 5 per item and capped while on', () => {
    expect(rainPreviewCounts(false, 3, 3)).toBeNull();
    expect(rainPreviewCounts(true, 0, 0)).toEqual({ rainbow: 0, yellow: 0 });
    expect(rainPreviewCounts(true, 1, 2)).toEqual({
      rainbow: RAIN_LINES_PER_ITEM,
      yellow: 2 * RAIN_LINES_PER_ITEM,
    });
    expect(rainPreviewCounts(true, 99, 99)).toEqual({ rainbow: RAIN_MAX_LINES, yellow: 0 });
  });
});
