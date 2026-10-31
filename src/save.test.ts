import { describe, expect, it } from 'vitest';
import { readSavePreview } from './save';

const storage = (value: string | null) => ({ getItem: () => value });

describe('readSavePreview', () => {
  it('returns null without a save', () => {
    expect(readSavePreview(storage(null), 'k')).toBeNull();
    expect(readSavePreview(undefined, 'k')).toBeNull();
  });

  it('reads world.stage', () => {
    expect(readSavePreview(storage(JSON.stringify({ world: 2, stage: 3 })), 'k')).toEqual({
      stage: '2.3',
    });
  });

  it('handles saves without a stage and broken JSON', () => {
    expect(readSavePreview(storage('{}'), 'k')).toEqual({ stage: null });
    expect(readSavePreview(storage('{oops'), 'k')).toBeNull();
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem(): string | null {
        throw new Error('SecurityError');
      },
    };
    expect(readSavePreview(blocked, 'k')).toBeNull();
  });
});
