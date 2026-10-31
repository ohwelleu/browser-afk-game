const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `'A4'` → 69. Accepts `#` and `b`. */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + accidental;
}

export const freq = (midiNote: number): number => 440 * 2 ** ((midiNote - 69) / 12);

/** `'D3 A3 D4'` → midi numbers. */
export const chord = (names: string): number[] => names.trim().split(/\s+/).map(midi);

export interface NoteEvent {
  midi: number;
  /** Length in steps. */
  len: number;
}

/**
 * Parse a melody like `'A4:2 D5:2 -:4 | G5:8'` (note:steps, `-` is a rest, `|` ends a bar)
 * into a map of absolute step → note. Throws if a bar does not add up to `barSteps`.
 */
export function phrase(src: string, barSteps: number, offset = 0): Map<number, NoteEvent> {
  const out = new Map<number, NoteEvent>();
  let step = offset;
  src.split('|').forEach((bar, i) => {
    let used = 0;
    for (const token of bar.trim().split(/\s+/)) {
      const [name, lenText] = token.split(':');
      const len = Number(lenText);
      if (!(len > 0)) throw new Error(`bad token "${token}"`);
      if (name !== '-') out.set(step, { midi: midi(name), len });
      step += len;
      used += len;
    }
    if (used !== barSteps) {
      throw new Error(`bar ${i + 1} has ${used} steps, expected ${barSteps}: "${bar.trim()}"`);
    }
  });
  return out;
}
