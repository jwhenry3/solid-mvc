/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// Files rendered INSIDE worker islands compile against the universal
// renderer (moduleName '@solid-mvc/atoll-island/worker'); everything else
// compiles for the DOM with '@solid-mvc/core/web' as the runtime module —
// its createComponent is what mounts View classes from JSX.
export const WORKER_FILES = [/\.worker\.[tj]sx?$/, /\.island\.[tj]sx?$/];

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
  ],
  resolve: {
    alias: [
      {
        // Same alias as vite.config.ts — vitest.config.ts takes precedence,
        // so it must be repeated here or `@/…` imports stop resolving.
        find: '@',
        replacement: r('./src'),
      },
      // NB: @atolljs/core@>=0.1.13 resolves every subpath (including
      // testing/inProcessWorker) to dist/, so bare and subpath imports
      // share one realm — no alias needed. (Earlier versions mixed
      // dist/index.js for the bare specifier with raw src/* subpaths:
      // two realms, two TaskRegistry instances.)
      {
        // solid-js resolves to dist/server.js under the node/worker
        // conditions — the SSR build where effects never re-run. Pin the
        // client build exactly (see docs/atoll/frameworks/solid.md).
        find: /^solid-js$/,
        replacement: r('./node_modules/solid-js/dist/solid.js'),
      },
      {
        find: /^solid-js\/web$/,
        replacement: r('./node_modules/solid-js/web/dist/web.js'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    server: {
      deps: {
        // Every dep that imports solid-js must resolve through vite —
        // externalized imports hit the node-condition SERVER build, a
        // second reactive realm where onCleanup no-ops and effects die.
        inline: [/solid-js/, /@solidjs\/testing-library/, /lucide-solid/, /@solidjs\/router/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // The publishable surface: core + the atoll adapter packages.
      // packages/cli is tooling, not runtime — its interactive shell
      // (readline, process.argv guard) isn't meaningfully coverable.
      include: ['packages/*/src/**'],
      exclude: [
        '**/*.{json,html,css,mjs}',
        '**/*.test.*',
        'packages/cli/**',
      ],
      // Floor slightly below the current baseline — regresses fail CI.
      thresholds: { statements: 95, branches: 85, functions: 92, lines: 95 },
    },
  },
});
