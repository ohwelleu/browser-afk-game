import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// The demo page embeds the built bundle exactly like a host page would
// (`<script src="./afk-game.js" defer>`). In dev there is no bundle yet, so
// swap that tag for the TypeScript entry served by Vite.
const EMBED_TAG = '<script src="./afk-game.js" defer></script>';
function demoDevEntry(): Plugin {
  return {
    name: 'afk-demo-dev-entry',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(EMBED_TAG, '<script type="module" src="/src/index.ts"></script>');
    },
  };
}

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [demoDevEntry()],
  publicDir: false,
  server: {
    open: '/demo/',
  },
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      name: 'AfkGame',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'es' ? 'afk-game.mjs' : 'afk-game.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
