/**
 * Shell surface — the error and lazy paths islands.test.tsx doesn't hit:
 * unresolvable app names, missing worker/client, mount rejections routed
 * to onError vs the failed box, and lazyIsland's module resolution order.
 * Same InProcessWorker harness as the islands suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'solid-js/web';
import type { JSX } from 'solid-js';
import { InProcessWorker } from '@atolljs/core/testing/inProcessWorker';
import { defineIslandContract, z } from '@solid-mvc/atoll';
import { defineViewPolyWorker, viewIsland } from './adapter';
import { Island, islandComponent, lazyIsland } from './shell';
import { ShellCounter } from './islands-test.worker';
// Importing the worker entry covers its re-export surface — the definer
// re-exports live in worker.ts for worker-side consumers.
import * as workerApi from './worker';

vi.stubGlobal('Worker', InProcessWorker);

const jsdomGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  Element: globalThis.Element,
  Node: globalThis.Node,
  Text: globalThis.Text,
  Comment: globalThis.Comment,
  HTMLMediaElement: globalThis.HTMLMediaElement,
  customElements: globalThis.customElements,
};
const restoreShellGlobals = (): void => {
  Object.assign(globalThis, jsdomGlobals);
};

const workerEntry = (): Worker =>
  new Worker(new URL('./islands-test.worker.tsx', import.meta.url), { type: 'module' });

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  // Two apps minimum: a sole-app registry resolves name-blind (ANY key
  // lands on the only app), so 'nope' mounts would succeed. With two,
  // 'nope' is genuinely unknown and the mount rejects.
  defineViewPolyWorker({ apps: { counter: ShellCounter, other: ShellCounter } });
  restoreShellGlobals();
});
afterEach(() => {
  document.body.innerHTML = '';
  // Rejected/failed mounts leak their spawned client (the component's
  // catch path has no handle to destroy). Terminate everything spawned
  // so later mounts aren't starved by idle pools polling on 50ms timers.
  for (const w of InProcessWorker.created) w.terminate();
});

const renderInto = async (el: JSX.Element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(() => el, container);
  await flush();
  return { container, dispose };
};

describe('shell', () => {
  it('worker entry re-exports the definer surface', () => {
    expect(workerApi.defineViewPolyWorker).toBe(defineViewPolyWorker);
    expect(workerApi.viewIslandApp).toBeTypeOf('function');
    expect(workerApi.emit).toBeTypeOf('function');
    expect(workerApi.islandComponent).toBe(islandComponent);
  });

  it('an unresolvable app renders the failure box instead of mounting', async () => {
    const { container } = await renderInto(<Island app={{}} />);
    expect(container.querySelector('.island-error')?.textContent).toMatch(
      /could not resolve an app name/,
    );
  });

  it('a resolvable app with no worker, client, or contract renders the failure box', async () => {
    const { container } = await renderInto(<Island app="counter" />);
    expect(container.querySelector('.island-error')?.textContent).toMatch(
      /requires either `worker`, `client`, or a contract/,
    );
  });

  it('a rejected mount routes to onError when provided', async () => {
    const onError = vi.fn();
    const { container, dispose } = await renderInto(
      <Island app="nope" worker={workerEntry} onError={onError} />,
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(container.querySelector('.island-error')).toBeNull();
    dispose();
  });

  it('a rejected mount without onError renders the failure box', async () => {
    const { container } = await renderInto(<Island app="nope" worker={workerEntry} />);
    await vi.waitFor(
      () =>
        expect(container.querySelector('.island-error')?.textContent).toMatch(
          /Island mount failed/,
        ),
      { timeout: 5000 },
    );
  });

  it('lazyIsland renders the fallback until the module resolves, then mounts', async () => {
    const contract = defineIslandContract({
      app: 'counter',
      props: z.object({ start: z.number().optional() }),
      worker: workerEntry,
    });
    const Lazy = lazyIsland(() => Promise.resolve({ default: contract }));
    const { container, dispose } = await renderInto(
      <Lazy props={{ start: 3 }} fallback={<span class="loading">…</span>} />,
    );
    // The fallback shows while the import is in flight; after resolution
    // the contract's own worker factory mounts the island for real.
    await vi.waitFor(
      () => expect(container.querySelector('.inc')?.textContent).toBe('count 3'),
      { timeout: 5000 },
    );
    dispose();
  });

  it('lazyIsland finds a contract among named module values', async () => {
    const contract = defineIslandContract({
      app: 'counter',
      worker: workerEntry,
    });
    const Lazy = lazyIsland(() => Promise.resolve({ other: 1, contract }));
    const { container, dispose } = await renderInto(<Lazy />);
    await vi.waitFor(() => expect(container.querySelector('.inc')).not.toBeNull(), {
      timeout: 5000,
    });
    dispose();
  });

  it('lazyIsland finds a stamped app among named module values', async () => {
    const stamped = viewIsland('counter', ShellCounter);
    const Lazy = lazyIsland(() => Promise.resolve({ app: stamped }));
    const { container, dispose } = await renderInto(<Lazy worker={workerEntry} />);
    await vi.waitFor(() => expect(container.querySelector('.inc')).not.toBeNull(), {
      timeout: 5000,
    });
    dispose();
  });

  it('lazyIsland falls back to the module itself when nothing resolves — and fails cleanly', async () => {
    const Lazy = lazyIsland(() => Promise.resolve({ default: { not: 'an island' } }));
    const { container, dispose } = await renderInto(<Lazy worker={workerEntry} />);
    await vi.waitFor(
      () =>
        expect(container.querySelector('.island-error')?.textContent).toMatch(
          /could not resolve an app name/,
        ),
      { timeout: 5000 },
    );
    dispose();
  });
});
