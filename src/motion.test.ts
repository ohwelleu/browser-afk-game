import { describe, expect, it } from 'vitest';
import {
  createMotion,
  isMotionSetting,
  MOTION_DEFAULT,
  MOTION_REDUCED_CLASS,
  reducedCss,
} from './motion';

/** classList stand-in: just a set of names. */
const fakeBox = () => {
  const names = new Set<string>();
  return {
    names,
    classList: {
      toggle: (n: string, on?: boolean) => (on ? names.add(n) : names.delete(n), !!on),
    } as unknown as DOMTokenList,
  };
};

describe('Animations setting', () => {
  it('defaults to On: animations play even when the OS asks for reduced motion', () => {
    expect(MOTION_DEFAULT).toBe('on');
    const box = fakeBox();
    const m = createMotion(box, undefined);
    expect(m.get()).toBe('on');
    expect(m.reduced()).toBe(false);
    expect(box.names.has(MOTION_REDUCED_CLASS)).toBe(false);
  });

  it('Reduced sets the class on the box and reduced(); On removes it', () => {
    const box = fakeBox();
    const m = createMotion(box, 'reduced');
    expect(m.reduced()).toBe(true);
    expect(box.names.has(MOTION_REDUCED_CLASS)).toBe(true);
    m.set('on');
    expect(m.reduced()).toBe(false);
    expect(box.names.has(MOTION_REDUCED_CLASS)).toBe(false);
  });

  it('ignores an unknown saved value', () => {
    expect(createMotion(fakeBox(), 'fast').get()).toBe('on');
    expect(isMotionSetting('reduced')).toBe(true);
    expect(isMotionSetting('Reduced')).toBe(false);
  });

  it('reducedCss scopes every selector to the class', () => {
    expect(reducedCss('.a, .b::before')).toBe('.motion-reduced .a, .motion-reduced .b::before');
  });
});
