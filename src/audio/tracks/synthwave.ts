// Retro synthwave chill: A minor (Aeolian), 90 BPM, 4/4, 16 bars (~43 s).
// Detuned saw pads, square arpeggio through a dotted-eighth echo, round bass, soft kick/hat.
// The second half adds a gentle snare and a triangle lead.

import { chord, freq, midi, phrase } from '../notes';
import { synthTrack } from '../sequencer';
import { bass, blip, echo, hat, kick, lead, pad, reverb, snare } from '../synth';

const BAR = 16; // sixteenth notes per bar
const BARS = 16;

// i – VI – III – VII, two bars each.
const PROGRESSION = [
  { pad: chord('A3 C4 E4 A4'), bass: midi('A2'), arp: chord('A4 C5 E5 A5') },
  { pad: chord('F3 A3 C4 E4'), bass: midi('F2'), arp: chord('F4 A4 C5 E5') },
  { pad: chord('G3 C4 E4 G4'), bass: midi('C3'), arp: chord('G4 C5 E5 G5') },
  { pad: chord('G3 B3 D4 G4'), bass: midi('G2'), arp: chord('G4 B4 D5 G5') },
];

/** Sixteenth in bar → chord tone for the arpeggio. */
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2];

const LEAD = phrase(
  'E5:6 D5:2 C5:4 D5:4 | E5:12 -:4 | F5:6 E5:2 C5:4 A4:4 | C5:12 -:4 |' +
    'G5:6 E5:2 C5:4 E5:4 | G5:12 -:4 | D5:6 B4:2 D5:4 G5:4 | D5:4 B4:4 -:8',
  BAR,
  8 * BAR, // starts at bar 9
);

export const synthwave = synthTrack('synthwave', {
  bpm: 90,
  stepsPerBeat: 4,
  steps: BAR * BARS,
  setup(ctx, out, dt) {
    const mix = ctx.createGain();
    mix.connect(out);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    mix.connect(reverb(ctx, 3, 3)).connect(wet).connect(out);

    const delay = echo(ctx, dt * 3, 0.35, 0.3); // dotted eighth
    delay.output.connect(mix);
    const arpBus = ctx.createGain();
    arpBus.connect(mix);
    arpBus.connect(delay.input);
    const leadBus = ctx.createGain();
    leadBus.connect(mix);
    leadBus.connect(delay.input);

    return {
      step(i, time) {
        const bar = Math.floor(i / BAR);
        const s = i % BAR;
        const ch = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
        const second = bar >= 8;

        if (s === 0 && bar % 2 === 0) pad(ctx, mix, time, ch.pad.map(freq), 2 * BAR * dt, 0.09);
        if (s % 2 === 0) {
          const octave = s === 6 || s === 14 ? 12 : 0;
          bass(ctx, out, time, freq(ch.bass + octave), dt * 1.6, s % 4 === 0 ? 0.13 : 0.09);
        }
        blip(ctx, arpBus, time, freq(ch.arp[ARP[s]]), dt * 1.8, second ? 0.03 : 0.045);

        if (s === 0 || s === 8) kick(ctx, out, time, 0.35);
        if (second && (s === 4 || s === 12)) snare(ctx, mix, time, 0.08);
        if (s % 4 === 2) hat(ctx, out, time, 0.03);

        const note = LEAD.get(i);
        if (note) lead(ctx, leadBus, time, freq(note.midi), note.len * dt * 0.95, 0.07);
      },
    };
  },
});
