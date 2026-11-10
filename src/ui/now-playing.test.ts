import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackCredit } from '../audio';
import { createNowPlaying, NOW_PLAYING_STYLES, nowPlayingText, type NoteEl } from './now-playing';

const gamingTime = trackCredit('gaming-time')!;

describe('nowPlayingText', () => {
  it('drops the "Music:" prefix', () => {
    expect(nowPlayingText(gamingTime)).toBe('♪ Gaming Time by Otrebil');
    expect(nowPlayingText({ text: 'Tune by X', url: 'u' })).toBe('♪ Tune by X');
  });
});

describe('createNowPlaying', () => {
  let el: NoteEl;
  beforeEach(() => {
    vi.useFakeTimers();
    el = { textContent: '', hidden: false } as NoteEl;
  });
  afterEach(() => vi.useRealTimers());

  it('starts hidden', () => {
    createNowPlaying(el);
    expect(el.hidden).toBe(true);
  });

  it('shows a credited track for 4 s, then hides', () => {
    const note = createNowPlaying(el);
    note.announce(gamingTime);
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('♪ Gaming Time by Otrebil');
    vi.advanceTimersByTime(3999);
    expect(el.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.hidden).toBe(true);
  });

  it('shows nothing for a track without a credit, and clears a note still showing', () => {
    const note = createNowPlaying(el);
    note.announce(undefined);
    expect(el.hidden).toBe(true);
    note.announce(gamingTime);
    note.announce(undefined);
    expect(el.hidden).toBe(true);
  });

  it('restarts the 4 s when announced again', () => {
    const note = createNowPlaying(el);
    note.announce(gamingTime);
    vi.advanceTimersByTime(3000);
    note.announce(gamingTime);
    vi.advanceTimersByTime(3000);
    expect(el.hidden).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(el.hidden).toBe(true);
  });

  it('destroy cancels the timer', () => {
    const note = createNowPlaying(el);
    note.announce(gamingTime);
    note.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('styles', () => {
  it('has a reduced-motion rule (Animations setting) and does not take clicks', () => {
    expect(NOW_PLAYING_STYLES).toContain('.motion-reduced .now-playing { transition: none; }');
    expect(NOW_PLAYING_STYLES).toContain('pointer-events: none');
  });
});
