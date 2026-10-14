/**
 * Vite plugin for the islands JSX split — importer-graph tagging.
 *
 * The dual-compile setup compiles `*.worker.*`/`*.island.*` files for the
 * universal renderer and everything else for the DOM. A file-glob include
 * list is enough for Bundles and Vitest, but dev mode transforms modules
 * individually and worker entries arrive as `?worker_file` URLs whose
 * transitive imports (views, ui components, shared helpers) carry no
 * marker at all. Without tagging they get DOM-compiled and crash inside
 * the worker (`template()`/`delegateEvents` against a documentless realm).
 *
 * This resolver stamps `?smvc-worker` onto every module reachable from a
 * worker entry (or an already-tagged importer). Add `WORKER_TAG_RE` to the
 * universal plugin's `include` and the DOM plugin's `exclude`; the tagged
 * id becomes a second module instance, so a shared component still gets
 * its DOM compile for the shell graph under the clean id.
 *
 * Usage:
 *   plugins: [
 *     workerUniversalTag(),
 *     solidPlugin({ include: WORKER_FILES, solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' }, babel: BABEL }),
 *     solidPlugin({ exclude: WORKER_FILES, solid: { moduleName: '@solid-mvc/core/web' }, babel: BABEL }),
 *   ]
 */

/** Query marker stamped on worker-graph module ids. */
export const WORKER_TAG = 'smvc-worker';
/** Matches a module id already tagged as worker-graph. */
export const WORKER_TAG_RE = /[?&]smvc-worker\b/;
/** Matches worker-entry filenames (unanchored — survives ?worker_file). */
export const WORKER_ENTRY_RE = /\.(worker|island)\.[tj]sx?/;
/** The include/exclude list for the dual solidPlugin instances. */
export const WORKER_FILES: RegExp[] = [
  /\.worker\.[tj]sx?/,
  /\.island\.[tj]sx?/,
  WORKER_TAG_RE,
];

import type { Plugin } from 'vite';

// The literal is checked against vite's Plugin, but the declared return
// is `any`: vite Plugin types are nominal across installs, so returning
// `Plugin` breaks when the consumer's vite (and its nested rollup) is a
// different copy than the one this package's types resolve — e.g. a
// workspace app's own node_modules, or a user on another vite major.
export function workerUniversalTag(): any {
  const plugin: Plugin = {
    name: 'smvc:worker-universal',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer) return null;
      if (!WORKER_ENTRY_RE.test(importer) && !WORKER_TAG_RE.test(importer)) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external || WORKER_TAG_RE.test(resolved.id)) return resolved;
      // Prebundled deps must keep ONE url per realm — a tagged copy gives
      // the worker two instances of e.g. the Solid reactive core
      // (solid-js.js vs solid-js.js?smvc-worker) and leaves effects dead.
      // Vite rewrites bare imports to /node_modules/.vite/deps AFTER
      // resolveId, so also skip compiled .js/.mjs under node_modules —
      // dep candidates. Raw .ts/.tsx/.jsx under node_modules (lucide-solid)
      // are served as source and DO need the universal compile.
      const path = resolved.id.replace(/\\/g, '/');
      if (path.includes('/.vite/')) return resolved;
      if (path.includes('/node_modules/') && /\.[cm]?js(\?|$)/.test(path)) return resolved;
      // Tag every source extension so the marker propagates through
      // non-JSX helpers (view -> utils.ts -> partial.tsx) without the
      // chain dropping back to DOM compile.
      if (/\.[jt]sx?(\?|$)/.test(path)) {
        resolved.id += (resolved.id.includes('?') ? '&' : '?') + WORKER_TAG;
      }
      return resolved;
    },
  };
  return plugin;
}
