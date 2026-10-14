import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { WORKER_FILES, workerUniversalTag } from '@solid-mvc/atoll-island/vite';
import { fileURLToPath } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// Worker-side island code compiles for the universal renderer (the
// atoll-island/worker runtime module); everything else compiles for the
// DOM with @solid-mvc/core/web as the runtime module — its createComponent
// is what mounts View classes from JSX. In dev the worker entry arrives as
// a ?worker_file URL and its whole import graph must compile universal
// too — workerUniversalTag() stamps ?smvc-worker onto every reachable
// module id, which WORKER_FILES matches.

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
  server: {
    // Pinned so the docs site's DemoFrame can find the dev demo reliably.
    port: 5175,
    strictPort: true,
    // The @solid-mvc/* workspace packages live OUTSIDE this package's root —
    // /@fs/ URLs and symlinked resolution need explicit allowance. Use the
    // absolute path: relative allow entries normalize differently than
    // resolved paths on Windows and resolution silently fails.
    fs: { allow: [r('../..')] },
  },
  resolve: {
    alias: [
      { find: '@', replacement: r('./src') },
      // ONE solid-js realm for the whole graph — and the CLIENT build at
      // that: worker chunks resolve the 'worker' condition (server build)
      // where effects never re-run. Regex on the bare specifier only.
      { find: /^solid-js$/, replacement: r('../../node_modules/solid-js/dist/solid.js') },
      { find: /^solid-js\/web$/, replacement: r('../../node_modules/solid-js/web/dist/web.js') },
    ],
  },
});
