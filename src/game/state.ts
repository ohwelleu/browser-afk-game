/**
 * Pure game logic. No DOM, canvas, audio or timers in here: `update` takes a
 * state and a fixed tick and returns the next state.
 */
export type GameState = {
  /** Simulated seconds since Start (only counts while running). */
  time: number;
  ticks: number;
};

export function createState(): GameState {
  return { time: 0, ticks: 0 };
}

export function update(state: GameState, dt: number): GameState {
  return { ...state, time: state.time + dt, ticks: state.ticks + 1 };
}
