export const TICK_RATE = 60;
export const TICK = 1 / TICK_RATE;
/** Longest frame we simulate; anything slower is dropped, never caught up. */
export const MAX_FRAME = 0.25;

/**
 * Fixed-timestep accumulator. Feed it real frame time, it tells you how many
 * fixed ticks to run.
 */
export function accumulate(acc: number, frameDt: number): { ticks: number; acc: number } {
  acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
  let ticks = 0;
  while (acc >= TICK) {
    acc -= TICK;
    ticks++;
  }
  return { ticks, acc };
}

/** rAF driver. Stopped = no frames scheduled at all (zero CPU). */
export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly tick: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  get running(): boolean {
    return this.raf !== 0;
  }

  start(): void {
    if (this.raf) return;
    // Resuming starts from "now": paused time is never simulated.
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number): void => {
    const step = accumulate(this.acc, (now - this.last) / 1000);
    this.last = now;
    this.acc = step.acc;
    for (let i = 0; i < step.ticks; i++) this.tick(TICK);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };
}
