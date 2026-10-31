export const DEFAULT_SAVE_KEY = "afk-game";

export type SavePreview = { stage: string | null };

/**
 * Peek at an existing save to label the Start button. Returns null when there
 * is no usable save. The full save format arrives with the shop milestone.
 */
export function readSavePreview(
  storage: Pick<Storage, "getItem"> | undefined,
  key: string,
): SavePreview | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    return null; // storage blocked (privacy mode, sandboxed iframe)
  }
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { world, stage } = data as { world?: unknown; stage?: unknown };
    const valid = Number.isInteger(world) && Number.isInteger(stage);
    return { stage: valid ? `${world as number}.${stage as number}` : null };
  } catch {
    return null;
  }
}
