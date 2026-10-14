/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { WORKER_FILES, workerUniversalTag } from '@solid-mvc/atoll-island/vite';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// Files rendered INSIDE worker islands compile against the universal
// renderer (moduleName '@solid-mvc/atoll-island/worker'); everything else
// compiles for the DOM with '@solid-mvc/core/web' as the runtime module —
// its createComponent is what mounts View classes from JSX. In dev the
// worker entry arrives as a ?worker_file URL and its whole import graph
// must compile universal too — workerUniversalTag() stamps ?smvc-worker
// onto every reachable module id, which WORKER_FILES matches.

// Babel must transform decorators itself — vite-plugin-solid's pipeline
// bypasses esbuild. legacy: true + loose class properties reproduces
// tsconfig's experimentalDecorators semantics.
const BABEL = {
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
  ],
};

export default defineConfig({
  plugins: [
    workerUniversalTag(),
    solidPlugin({
      include: WORKER_FILES,
      solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' },
      babel: BABEL,
    }),
    solidPlugin({
      exclude: WORKER_FILES,
      solid: { moduleName: '@solid-mvc/core/web' },
      babel: BABEL,
    }),
    tailwindcss(),
  ],
  worker: {
    // Vite 6 does NOT inherit config.plugins for worker bundles — without
    // this, island .tsx falls back to esbuild classic JSX (React.*). Every
    // module reachable from a worker entry renders into the proxy DOM, so
    // the whole bundle compiles universal — no file-glob split here.
    // format: 'es' keeps import.meta alive (the iife default breaks nested
    // `new Worker(new URL(..., import.meta.url))` sub-island entries).
    format: 'es',
    plugins: () => [
      solidPlugin({
        solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' },
        babel: BABEL,
      }),
    ],
  },
  resolve: {
    alias: [
      { find: '@', replacement: r('./src') },
      {
        // Worker bundles resolve solid-js to dist/server.js under the
        // 'worker' export condition — the SSR build where effects never
        // re-run. Pin the client build for every chunk (see
        // docs/atoll/frameworks/solid.md).
        find: /^solid-js$/,
        replacement: r('./node_modules/solid-js/dist/solid.js'),
      },
      {
        find: /^solid-js\/web$/,
        replacement: r('./node_modules/solid-js/web/dist/web.js'),
      },
    ],
  },
});
