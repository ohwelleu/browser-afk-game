/**
 * Bundles `src/sim/index.ts` for plain Node. The game sources use
 * extensionless imports, which Node can't resolve, so the CLI runs this
 * bundle instead (docs/design/simulator.md → 6). Output goes to
 * `node_modules/.cache/afk-sim/`, never into the repo or the game build.
 */
import { join } from 'node:path';
import { build } from 'vite';

export const BUNDLE_DIR = join('node_modules', '.cache', 'afk-sim');
export const BUNDLE_FILE = 'sim.mjs';

/** Builds the bundle and returns its absolute path. */
export async function bundleSim(root: string = process.cwd()): Promise<string> {
  await build({
    configFile: false,
    root,
    logLevel: 'error',
    publicDir: false,
    build: {
      ssr: 'src/sim/index.ts',
      outDir: BUNDLE_DIR,
      emptyOutDir: false,
      target: 'node20',
      minify: false,
      rollupOptions: { output: { format: 'es', entryFileNames: BUNDLE_FILE } },
    },
  });
  return join(root, BUNDLE_DIR, BUNDLE_FILE);
}
