// Small Web Audio instruments. Each note builds its own short-lived nodes, which
// the browser frees once they stop. `level` is peak gain into `out`.

type Ctx = BaseAudioContext;

function osc(ctx: Ctx, type: OscillatorType, f: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  return o;
}

function gain(ctx: Ctx, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function filter(ctx: Ctx, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

// --- noise & effects ---------------------------------------------------------

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

function noise(ctx: Ctx): AudioBufferSourceNode {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/** Short noise burst through a filter, decaying exponentially. */
function noiseHit(
  ctx: Ctx,
  out: AudioNode,
  time: number,
  type: BiquadFilterType,
  f: number,
  q: number,
  level: number,
  decay: number,
): void {
  const src = noise(ctx);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(level, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  src.connect(filter(ctx, type, f, q)).connect(amp).connect(out);
  src.start(time, Math.random() * 1.5);
  src.stop(time + decay + 0.02);
}

/** Stereo reverb from a generated decaying-noise impulse response. */
export function reverb(ctx: Ctx, seconds = 3, decay = 2.5): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  const c = ctx.createConvolver();
  c.buffer = ir;
  return c;
}

/** Feedback delay with a darkening filter in the loop. Connect to `input`, take `output`. */
export function echo(ctx: Ctx, delay: number, feedback: number, wet: number) {
  const input = gain(ctx);
  const output = gain(ctx, wet);
  const d = ctx.createDelay(2);
  d.delayTime.value = delay;
  const tone = filter(ctx, 'lowpass', 2500);
  input.connect(d).connect(tone).connect(gain(ctx, feedback)).connect(d);
  tone.connect(output);
  return { input, output };
}

// --- medieval ----------------------------------------------------------------

const ksBuffers = new WeakMap<Ctx, Map<string, AudioBuffer>>();

/**
 * Karplus-Strong string: a burst of noise in a delay line of `period` samples,
 * averaged each pass so it decays like a plucked string. Rendered once per pitch.
 */
function ksBuffer(ctx: Ctx, period: number, seconds: number, damping: number, brightness: number) {
  const key = `${period}:${seconds}:${damping}:${brightness}`;
  let byKey = ksBuffers.get(ctx);
  if (!byKey) ksBuffers.set(ctx, (byKey = new Map()));
  let buffer = byKey.get(key);
  if (buffer) return buffer;

  const len = Math.floor(ctx.sampleRate * seconds);
  buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  // Excitation: low-passed noise (lower brightness = softer, more lute-like pluck).
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < period; i++) {
    lp += brightness * (Math.random() * 2 - 1 - lp);
    d[i] = lp;
    mean += lp / period;
  }
  let peak = 0;
  for (let i = 0; i < period; i++) peak = Math.max(peak, Math.abs((d[i] -= mean)));
  for (let i = 0; i < period; i++) d[i] /= peak || 1;
  for (let i = period; i < len; i++) {
    d[i] = damping * 0.5 * (d[i - period] + d[i - period - 1 < 0 ? 0 : i - period - 1]);
  }
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  byKey.set(key, buffer);
  return buffer;
}

export interface PluckOptions {
  seconds?: number;
  /** Per-period loss, closer to 1 rings longer. */
  damping?: number;
  /** 0..1, brightness of the pluck. */
  brightness?: number;
}

/** Plucked lute/harp string (Karplus-Strong). */
export function pluck(
  ctx: Ctx,
  out: AudioNode,
  time: number,
  f: number,
  level: number,
  { seconds = 2.5, damping = 0.996, brightness = 0.5 }: PluckOptions = {},
): void {
  // The two-tap average adds half a sample of delay; the playback rate fixes the rest of the tuning.
  const period = Math.max(2, Math.round(ctx.sampleRate / f - 0.5));
  const src = ctx.createBufferSource();
  src.buffer = ksBuffer(ctx, period, seconds, damping, brightness);
  src.playbackRate.value = ctx.sampleRate / (period + 0.5) / f;
  src.connect(gain(ctx, level)).connect(out);
  src.start(time);
}

/** Recorder/flute: soft triangle with breath chiff and delayed vibrato. */
export function flute(ctx: Ctx, out: AudioNode, time: number, f: number, dur: number, level: number): void {
  const end = time + dur;
  const body = osc(ctx, 'triangle', f);
  const overtone = osc(ctx, 'sine', f * 2);
  const vibrato = osc(ctx, 'sine', 5 + Math.random() * 0.6);
  const depth = gain(ctx, 0);
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(f * 0.005, time + Math.min(0.45, dur));
  vibrato.connect(depth);
  depth.connect(body.frequency);
  depth.connect(overtone.frequency);

  const tone = filter(ctx, 'lowpass', Math.min(f * 5, 6000));
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.06);
  amp.gain.linearRampToValueAtTime(level * 0.8, time + Math.min(0.2, dur));
  amp.gain.setValueAtTime(level * 0.8, end);
  amp.gain.setTargetAtTime(0, end, 0.05);
  body.connect(tone);
  overtone.connect(gain(ctx, 0.12)).connect(tone);
  tone.connect(amp).connect(out);
  noiseHit(ctx, out, time, 'bandpass', f * 3, 3, level * 0.5, 0.06);

  for (const o of [body, overtone, vibrato]) {
    o.start(time);
    o.stop(end + 0.4);
  }
}

/** Held drone (hurdy-gurdy / bagpipe), detuned saws through a slowly moving low-pass. */
export function drone(ctx: Ctx, out: AudioNode, freqs: number[], level: number) {
  const t = ctx.currentTime;
  const tone = filter(ctx, 'lowpass', 600, 1);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(level, t + 3);
  tone.connect(amp).connect(out);
  const lfo = osc(ctx, 'sine', 0.07);
  lfo.connect(gain(ctx, 180)).connect(tone.frequency);
  const sum = gain(ctx, 1 / (freqs.length * 2));
  sum.connect(tone);
  const oscs = [lfo];
  for (const f of freqs) {
    for (const cents of [-5, 5]) {
      const o = osc(ctx, 'sawtooth', f, cents);
      o.connect(sum);
      oscs.push(o);
    }
  }
  for (const o of oscs) o.start(t);
  return {
    stop(time: number) {
      for (const o of oscs) o.stop(time);
    },
  };
}

/** Tabor / frame drum: soft pitched thump plus a little skin noise. */
export function tabor(ctx: Ctx, out: AudioNode, time: number, level: number): void {
  const o = osc(ctx, 'sine', 140);
  o.frequency.setValueAtTime(140, time);
  o.frequency.exponentialRampToValueAtTime(70, time + 0.12);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
  o.connect(amp).connect(out);
  o.start(time);
  o.stop(time + 0.4);
  noiseHit(ctx, out, time, 'bandpass', 1200, 1, level * 0.25, 0.06);
}

// --- synthwave ---------------------------------------------------------------

/** Soft pad: detuned saw pairs, slow attack and release, gently opening filter. */
export function pad(ctx: Ctx, out: AudioNode, time: number, freqs: number[], dur: number, level: number): void {
  const end = time + dur;
  const tone = filter(ctx, 'lowpass', 500, 0.5);
  tone.frequency.setValueAtTime(500, time);
  tone.frequency.linearRampToValueAtTime(1400, time + dur * 0.5);
  tone.frequency.linearRampToValueAtTime(700, end + 1.5);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 1);
  amp.gain.setValueAtTime(level, end);
  amp.gain.setTargetAtTime(0, end, 0.5);
  const sum = gain(ctx, 1 / (freqs.length * 2));
  sum.connect(tone).connect(amp).connect(out);
  for (const f of freqs) {
    for (const cents of [-8, 8]) {
      const o = osc(ctx, 'sawtooth', f, cents);
      o.connect(sum);
      o.start(time);
      o.stop(end + 3);
    }
  }
}

/** Arpeggio blip: filtered square with a quick decay. */
export function blip(ctx: Ctx, out: AudioNode, time: number, f: number, len: number, level: number): void {
  const o = osc(ctx, 'square', f);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + len);
  o.connect(filter(ctx, 'lowpass', 1800)).connect(amp).connect(out);
  o.start(time);
  o.stop(time + len + 0.02);
}

/** Round bass: saw + sine sub with a short filter pluck. */
export function bass(ctx: Ctx, out: AudioNode, time: number, f: number, dur: number, level: number): void {
  const end = time + dur;
  const tone = filter(ctx, 'lowpass', 900, 2);
  tone.frequency.setValueAtTime(900, time);
  tone.frequency.exponentialRampToValueAtTime(300, time + 0.2);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.01);
  amp.gain.linearRampToValueAtTime(level * 0.6, time + 0.2);
  amp.gain.setTargetAtTime(0, end, 0.03);
  tone.connect(amp).connect(out);
  const saw = osc(ctx, 'sawtooth', f);
  const sub = osc(ctx, 'sine', f);
  saw.connect(gain(ctx, 0.5)).connect(tone);
  sub.connect(tone);
  for (const o of [saw, sub]) {
    o.start(time);
    o.stop(end + 0.2);
  }
}

/** Mellow lead: triangle plus a quiet detuned saw, delayed vibrato. */
export function lead(ctx: Ctx, out: AudioNode, time: number, f: number, dur: number, level: number): void {
  const end = time + dur;
  const tri = osc(ctx, 'triangle', f);
  const saw = osc(ctx, 'sawtooth', f, 6);
  const vibrato = osc(ctx, 'sine', 5.5);
  const depth = gain(ctx, 0);
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(f * 0.004, time + Math.min(0.5, dur));
  vibrato.connect(depth);
  depth.connect(tri.frequency);
  depth.connect(saw.frequency);
  const tone = filter(ctx, 'lowpass', 2200);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.03);
  amp.gain.setValueAtTime(level, end);
  amp.gain.setTargetAtTime(0, end, 0.08);
  tri.connect(tone);
  saw.connect(gain(ctx, 0.25)).connect(tone);
  tone.connect(amp).connect(out);
  for (const o of [tri, saw, vibrato]) {
    o.start(time);
    o.stop(end + 0.6);
  }
}

export function kick(ctx: Ctx, out: AudioNode, time: number, level: number): void {
  const o = osc(ctx, 'sine', 150);
  o.frequency.setValueAtTime(150, time);
  o.frequency.exponentialRampToValueAtTime(45, time + 0.15);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(level, time + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
  o.connect(amp).connect(out);
  o.start(time);
  o.stop(time + 0.45);
}

export function snare(ctx: Ctx, out: AudioNode, time: number, level: number): void {
  noiseHit(ctx, out, time, 'bandpass', 1500, 0.8, level, 0.18);
  const body = osc(ctx, 'triangle', 190);
  body.frequency.setValueAtTime(190, time);
  body.frequency.exponentialRampToValueAtTime(150, time + 0.1);
  const amp = gain(ctx, 0);
  amp.gain.setValueAtTime(level * 0.5, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
  body.connect(amp).connect(out);
  body.start(time);
  body.stop(time + 0.12);
}

export function hat(ctx: Ctx, out: AudioNode, time: number, level: number): void {
  noiseHit(ctx, out, time, 'highpass', 7000, 0.7, level, 0.05);
}
