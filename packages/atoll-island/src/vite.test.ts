/**
 * workerUniversalTag's resolveId — the dev-mode tagging logic that keeps
 * worker-reachable modules on the universal compile. Exercised directly:
 * resolveId is a pure function of (source, importer, resolved id) once
 * `this.resolve` is stubbed.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  workerUniversalTag,
  WORKER_TAG,
  WORKER_TAG_RE,
  WORKER_ENTRY_RE,
  WORKER_FILES,
} from './vite';

const callResolveId = (
  resolvedId: string | null,
  source = './dep.tsx',
  importer = '/src/app/counter.worker.tsx',
) => {
  const resolve = vi.fn(async () =>
    resolvedId === null ? null : { id: resolvedId },
  );
  const plugin = workerUniversalTag();
  return plugin.resolveId.call({ resolve }, source, importer, {});
};

describe('workerUniversalTag', () => {
  it('exposes the constants the dual-plugin setup consumes', () => {
    expect(WORKER_TAG).toBe('smvc-worker');
    expect(WORKER_TAG_RE.test('/x.ts?smvc-worker')).toBe(true);
    expect(WORKER_ENTRY_RE.test('a.worker.ts')).toBe(true);
    expect(WORKER_ENTRY_RE.test('a.island.tsx?worker_file')).toBe(true);
    expect(WORKER_FILES).toContain(WORKER_TAG_RE);
  });

  it('ignores entry points and non-worker importers', async () => {
    expect(await callResolveId('/abs/dep.tsx', './dep.tsx', null as any)).toBeNull();
    expect(await callResolveId('/abs/dep.tsx', './dep.tsx', '/src/app/main.tsx')).toBeNull();
  });

  it('tags source files reachable from a worker entry', async () => {
    const resolved = await callResolveId('/abs/dep.tsx');
    expect(resolved!.id).toBe('/abs/dep.tsx?smvc-worker');
  });

  it('propagates the tag through already-tagged importers', async () => {
    const resolved = await callResolveId(
      '/abs/util.ts',
      './util.ts',
      '/src/app/view.tsx?smvc-worker',
    );
    expect(resolved!.id).toBe('/abs/util.ts?smvc-worker');
  });

  it('appends with & when the id already has a query', async () => {
    const resolved = await callResolveId('/abs/dep.tsx?raw-ts');
    expect(resolved!.id).toBe('/abs/dep.tsx?raw-ts&smvc-worker');
  });

  it('passes through unresolvable, external, and already-tagged ids', async () => {
    expect(await callResolveId(null)).toBeNull();
    const external = await callResolveId('/abs/dep.tsx?smvc-worker');
    expect(external!.id).toBe('/abs/dep.tsx?smvc-worker');
  });

  it('never tags prebundled deps — one realm per module instance', async () => {
    for (const id of [
      '/node_modules/.vite/deps/solid-js.js',
      '/node_modules/some-pkg/dist/index.js',
      '/node_modules/some-pkg/dist/index.mjs',
      'C:\\x\\node_modules\\pkg\\index.js',
    ]) {
      const resolved = await callResolveId(id);
      expect(resolved!.id).toBe(id);
    }
  });

  it('still tags raw source under node_modules (unpublished deps need the compile)', async () => {
    const resolved = await callResolveId('/node_modules/lucide-solid/icons/x.jsx');
    expect(resolved!.id).toBe('/node_modules/lucide-solid/icons/x.jsx?smvc-worker');
  });

  it('leaves non-source assets untagged', async () => {
    const resolved = await callResolveId('/src/app/logo.svg');
    expect(resolved!.id).toBe('/src/app/logo.svg');
  });
});
