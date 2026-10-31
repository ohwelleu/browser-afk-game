import { describe, expect, it } from 'vitest';
import { computeView } from './view';

const content = { width: 100, height: 80 };

describe('computeView', () => {
  it('picks the largest whole-number scale that fits the height', () => {
    expect(computeView(800, 160, 1, content).scale).toBe(2);
    expect(computeView(800, 160, 2, content).scale).toBe(4);
    expect(computeView(800, 200, 1, content).scale).toBe(2);
  });

  it('leaves room for the HUD band', () => {
    expect(computeView(2000, 546, 1, content).scale).toBe(6);
    expect(computeView(2000, 546, 1, content, 60).scale).toBe(6);
    expect(computeView(2000, 546, 1, content, 100).scale).toBe(5);
  });

  it('drops the scale on narrow screens', () => {
    expect(computeView(360, 546, 1, content).scale).toBe(3);
  });

  it('never goes below 1x', () => {
    expect(computeView(100, 20, 1, content).scale).toBe(1);
  });

  it('sizes the backing store in device pixels and pins the scene to the bottom', () => {
    const v = computeView(801, 170, 1.5, content);
    expect(v.pxWidth).toBe(1202);
    expect(v.pxHeight).toBe(255);
    expect(v.scale).toBe(3);
    expect(v.width).toBe(Math.ceil(1202 / 3));
    expect(v.height).toBe(85);
    expect(v.offsetY).toBe(0);
  });
});
