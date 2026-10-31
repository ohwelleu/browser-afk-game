// Medieval ambient: D Dorian, 70 BPM, 4/4, 16 bars (~55 s).
// Plucked harp arpeggios (Karplus-Strong), recorder melody, a held D–A drone and a soft tabor.

import { chord, freq, phrase } from '../notes';
import { synthTrack } from '../sequencer';
import { drone, flute, pluck, reverb, tabor } from '../synth';

const BAR = 8; // eighth notes per bar
const BARS = 16;

// i – VII – IV – i – III – VII – IV – v. The major IV (G, with B natural) is the Dorian colour.
const CHORDS = [
  'D3 A3 D4 F4',
  'C3 G3 C4 E4',
  'G2 D3 G3 B3',
  'D3 A3 D4 F4',
  'F2 C3 F3 A3',
  'C3 G3 C4 E4',
  'G2 D3 G3 B3',
  'A2 E3 A3 C4',
].map(chord);

/** Step in bar → chord tone for the harp. Rests on steps 1 and 5 keep it unhurried. */
const HARP: Partial<Record<number, number>> = { 0: 0, 2: 1, 3: 2, 4: 3, 6: 2, 7: 1 };
/** Step in bar → tabor velocity. */
const TABOR: Partial<Record<number, number>> = { 0: 1, 5: 0.4, 6: 0.6 };

const MELODY = phrase(
  // A: bars 1–8
  'A4:2 D5:2 E5:2 F5:2 | G5:4 E5:2 C5:2 | D5:4 B4:2 G4:2 | A4:6 -:2 |' +
    'C5:2 F5:2 A5:2 G5:2 | E5:4 D5:2 C5:2 | B4:2 D5:2 G5:2 F5:1 E5:1 | E5:6 -:2 |' +
    // B: bars 9–16, higher answer that settles back on E for the loop
    'D6:4 C6:2 A5:2 | G5:4 E5:2 G5:2 | B5:3 A5:1 G5:2 D5:2 | F5:2 E5:2 D5:4 |' +
    'A5:2 C6:2 A5:2 F5:2 | G5:2 E5:2 C5:4 | D5:2 G5:2 B5:2 A5:2 | E5:2 D5:2 E5:4',
  BAR,
);

export const medieval = synthTrack('medieval', {
  bpm: 70,
  stepsPerBeat: 2,
  steps: BAR * BARS,
  setup(ctx, out, dt) {
    const mix = ctx.createGain();
    mix.connect(out);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    mix.connect(reverb(ctx, 3.5, 2.5)).connect(wet).connect(out);
    const hum = drone(ctx, mix, chord('D2 A2 D3').map(freq), 0.07);

    return {
      step(i, time) {
        const bar = Math.floor(i / BAR);
        const s = i % BAR;
        const notes = CHORDS[bar % CHORDS.length];
        // A few ms of human timing so the plucks don't sound like a machine.
        const human = Math.random() * 0.008;

        const tone = HARP[s];
        if (tone !== undefined) {
          const downbeat = s === 0;
          pluck(ctx, mix, time + human, freq(notes[tone]), downbeat ? 0.3 : 0.2, {
            seconds: downbeat ? 3.5 : 2.5,
            damping: downbeat ? 0.997 : 0.995,
            brightness: downbeat ? 0.35 : 0.5,
          });
        }
        const drum = TABOR[s];
        if (drum) tabor(ctx, mix, time, 0.12 * drum);

        const note = MELODY.get(i);
        if (note) flute(ctx, mix, time, freq(note.midi), note.len * dt * 0.92, 0.1);
      },
      stop(time) {
        hum.stop(time);
      },
    };
  },
});
