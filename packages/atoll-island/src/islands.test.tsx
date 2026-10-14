/**
 * Islands end-to-end — the worker definition runs in-process (Atoll's
 * InProcessWorker pattern): ops serialize for real, the driver replays them
 * onto jsdom, events round-trip as dispatch calls. A module-level signal
 * shared with the island app stands in for worker-side state — in a real
 * worker the signal lives in the worker; in-process the realms share one
 * heap, which is exactly what makes poking it a faithful out-of-task test.
 *
 * The island views live in islands-test.worker.tsx so the universal-JSX
 * plugin instance compiles them for the proxy-DOM renderer; this file is
 * shell-side (DOM-compiled).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'solid-js/web';
import { fireEvent } from '@solidjs/testing-library';
import { InProcessWorker } from '@atolljs/core/testing/inProcessWorker';
import { definePolyWorker } from '@solid-mvc/atoll/worker';
import { defineViewPolyWorker, defineViewMonoWorker, viewIsland } from './adapter';
import {
  callbackProp,
  connectIslandWorker,
  defineIslandContract,
  mountIsland,
  z,
} from '@solid-mvc/atoll';
import { Island, islandComponent } from './shell';
import type { IslandWorkerDef } from '@solid-mvc/atoll/worker';
import {
  CounterIsland,
  TickerIsland,
  GreetIsland,
  LeaveIsland,
  SvgIsland,
  tick,
  leaves,
} from './islands-test.worker';

// The real Atoll harness: stub the Worker global with InProcessWorker —
// the pool's INIT/EXECUTE_TASK protocol runs in-process against the real
// TaskRegistry. The `def` objects below register at defineViewPolyWorker
// call time (module-level union), so no handlerModules are needed.
vi.stubGlobal('Worker', InProcessWorker);

// keepAlive needs @atolljs/islands ≥0.1.12 (isKeepAliveClient is internal,
// not exported — the pinned dep provides it; on older versions the option
// is silently dropped and this test fails loudly, which is what we want).

// In-process the worker and shell share jsdom's globals — and the islands
// worker's instance dispatcher shadows `document`/`window`/`Element`… so
// out-of-task reads resolve the ambient PROXY document (its docs even call
// out that "lets test harnesses/suites restore globals by plain
// assignment"). Capture the real jsdom globals before any worker def runs
// and hand them back through the dispatcher's override setters after it
// installs: instance tasks still see the active proxy doc, the driver and
// this file see real DOM.
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

const mountInto = (
  def: IslandWorkerDef,
  opts: Omit<Parameters<typeof mountIsland>[0], 'el' | 'worker'>,
) => {
  void def; // registration already ran — the factory spawns the in-process worker
  const el = document.createElement('div');
  document.body.appendChild(el);
  return mountIsland({ el, worker: workerEntry, ...opts });
};

let def: IslandWorkerDef;
beforeEach(() => {
  def = defineViewPolyWorker({
    // registration is a module-level UNION in the shared realm — every def
    // below adds to the same APP_REGISTRY
    apps: {
      counter: CounterIsland,
      ticker: TickerIsland,
      greet: GreetIsland,
      leave: LeaveIsland,
      svg: SvgIsland,
      stamp: {
        imperative: (doc, props) => {
          const d = doc.createElement('div');
          d.className = 'stamp';
          d.textContent = `imperative: ${props.msg}`;
          doc.body.appendChild(d);
        },
      },
    },
  });
  // The def's definePolyWorker just installed the instance dispatcher —
  // give the jsdom globals back to the shell half of the realm.
  restoreShellGlobals();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('islands', () => {
  it('mounts a View island — proxy DOM ops replay to real DOM', async () => {
    const island = await mountInto(def, { app: 'counter', props: { start: 2 } });
    expect(island.instance).toBe('counter@' + island.instance.split('@')[1]);
    expect(island.pid).toMatch(/^w-/);
    const btn = document.querySelector('.inc')!;
    expect(btn.textContent).toBe('count 2');
    island.destroy();
  });

  it('dispatches real events back to the worker (click → re-render)', async () => {
    const island = await mountInto(def, { app: 'counter' });
    const btn = document.querySelector('.inc')! as HTMLButtonElement;
    fireEvent.click(btn);
    await flush();
    expect(btn.textContent).toBe('count 1');
    island.destroy();
  });

  it('emit() lands in onEvent', async () => {
    const events: [string, unknown][] = [];
    const island = await mountInto(def, {
      app: 'counter',
      props: { start: 4 },
      onEvent: (n, p) => events.push([n, p]),
    });
    fireEvent.click(document.querySelector('.inc')!);
    await flush();
    expect(events).toEqual([['five', { count: 5 }]]);
    island.destroy();
  });

  it('updateProps re-renders the root with new props', async () => {
    const island = await mountInto(def, { app: 'counter', props: { label: 'a' } });
    expect(document.querySelector('h3')!.textContent).toBe('a');
    island.updateProps({ label: 'b' });
    await flush();
    expect(document.querySelector('h3')!.textContent).toBe('b');
    island.destroy();
  });

  it('out-of-task signal writes flush ops without a task call', async () => {
    const island = await mountInto(def, { app: 'ticker' });
    expect(document.querySelector('.tick')!.textContent).toBe('tick 0');
    tick.value = 7;
    // Message-only transport: the 50ms poll timer fires the worker's
    // flush() task, which drains the ops committed outside task calls.
    await new Promise((r) => setTimeout(r, 120));
    expect(document.querySelector('.tick')!.textContent).toBe('tick 7');
    island.destroy();
  });

  it('svg elements replay in the SVG namespace', async () => {
    const island = await mountInto(def, { app: 'svg' });
    const svg = document.querySelector('svg')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelector('circle')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    island.destroy();
  });

  it('multi-word events (onMouseLeave) dispatch to the worker', async () => {
    const before = leaves.value;
    const island = await mountInto(def, { app: 'leave' });
    const box = document.querySelector('.leavebox')! as HTMLElement;
    fireEvent.mouseEnter(box);
    fireEvent.mouseLeave(box);
    await flush();
    expect(leaves.value).toBe(before + 1);
    island.destroy();
  });

  it('island-side DI: component providers resolve in the worker scope', async () => {
    const island = await mountInto(def, { app: 'greet', props: { name: 'island' } });
    expect(document.querySelector('.greet')!.textContent).toBe('hello island');
    island.destroy();
  });

  it('imperative apps render via the proxy DOM and rebuild on updateProps', async () => {
    const island = await mountInto(def, {
      app: 'stamp',
      props: { msg: 'one' },
    });
    expect(document.querySelector('.stamp')!.textContent).toBe('imperative: one');
    island.updateProps({ msg: 'two' });
    await flush();
    expect(document.querySelector('.stamp')!.textContent).toBe('imperative: two');
    island.destroy();
  });

  it('callbackProp: worker code can invoke a shell function', async () => {
    const done: unknown[] = [];
    const d2 = definePolyWorker({
      apps: {
        caller: {
          imperative: (doc, props) => {
            const b = doc.createElement('button');
            b.textContent = 'call';
            doc.body.appendChild(b);
            (props.onDone as (...a: unknown[]) => void)(42);
          },
        },
      },
    });
    const island = await mountInto(d2, {
      app: 'caller',
      props: { onDone: callbackProp((n: number) => done.push(n)) },
    });
    await flush();
    expect(done).toEqual([42]);
    island.destroy();
  });

  it('several islands share one client — distinct instances, one worker', async () => {
    const client = connectIslandWorker({ worker: workerEntry });
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    document.body.append(elA, elB);
    const a = await mountIsland({ el: elA, client, app: 'counter', props: { start: 1 } });
    const b = await mountIsland({ el: elB, client, app: 'counter', props: { start: 9 } });
    expect(a.instance).not.toBe(b.instance);
    expect(elA.querySelector('.inc')!.textContent).toBe('count 1');
    expect(elB.querySelector('.inc')!.textContent).toBe('count 9');
    // updating one doesn't touch the other
    fireEvent.click(elA.querySelector('.inc')!);
    await flush();
    expect(elA.querySelector('.inc')!.textContent).toBe('count 2');
    expect(elB.querySelector('.inc')!.textContent).toBe('count 9');
    a.destroy();
    b.destroy();
  });

  it(
    'keepAlive: destroy unmounts the instance but leaves the worker resident for warm remount',
    async () => {
      const client = connectIslandWorker({ worker: workerEntry, keepAlive: true });
      const spawned = (): { terminated: boolean } => {
        const created = InProcessWorker.created;
        return created[created.length - 1] as { terminated: boolean };
      };
      const elA = document.createElement('div');
      document.body.append(elA);
      const a = await mountIsland({ el: elA, client, app: 'counter', props: { start: 1 } });
      expect(elA.querySelector('.inc')!.textContent).toBe('count 1');

      a.destroy();
      // The instance tears down but the thread must stay up — keepAlive
      // survives the last unmount.
      await vi.waitFor(() => expect(elA.querySelector('.inc')).toBeNull());
      expect(spawned().terminated).toBe(false);

      // A remount lands on the same resident worker — no respawn.
      const first = spawned();
      const elB = document.createElement('div');
      document.body.append(elB);
      const b = await mountIsland({ el: elB, client, app: 'counter', props: { start: 7 } });
      expect(elB.querySelector('.inc')!.textContent).toBe('count 7');
      expect(spawned()).toBe(first);
      b.destroy();
      // Let the unmount round-trip settle before the explicit terminate —
      // terminating mid-flight rejects the call as WorkerCrashedError.
      await vi.waitFor(() => expect(elB.querySelector('.inc')).toBeNull());
      client.terminate();
      expect(spawned().terminated).toBe(true);
    },
  );

  it('mono worker app mounts by registry name (name-blind only for a sole-app registry)', async () => {
    // In-process the registry is a union of every def in this file, so the
    // single-app name fallback can't kick in — mount by the app's key.
    const mono = defineViewMonoWorker(viewIsland('mono', CounterIsland));
    const island = await mountInto(mono, { app: 'mono', props: { start: 3 } });
    expect(document.querySelector('.inc')!.textContent).toBe('count 3');
    island.destroy();
  });

  it('unknown app rejects the mount with a named error', async () => {
    await expect(mountInto(def, { app: 'nope' })).rejects.toThrow(/unknown app "nope/);
  });

  it('a bare function prop is rejected — wrap it in callbackProp', async () => {
    await expect(
      mountInto(def, { app: 'counter', props: { cb: (() => {}) as unknown as never } }),
    ).rejects.toThrow(/callbackProp/);
  });

  it('destroy tears the instance down — further updates reject', async () => {
    const island = await mountInto(def, { app: 'counter' });
    island.destroy();
    await flush();
    // The driver drops unmount's return batch (the element is the mount
    // site's problem), but the worker-side instance is gone — calls reject.
    await expect(island.updateProps({ start: 99 })).rejects.toThrow(/not mounted/);
  });

  it('stamped app references resolve to their wire key', async () => {
    const stamped = viewIsland('counter', CounterIsland);
    const d2 = defineViewPolyWorker({ apps: { counter: stamped } });
    const island = await mountInto(d2, { app: stamped, props: { start: 6 } });
    expect(island.app).toBe('counter');
    expect(document.querySelector('.inc')!.textContent).toBe('count 6');
    island.destroy();
  });

  it('contract facade: islandComponent mounts with no worker prop — the contract carries the entry', async () => {
    const contract = defineIslandContract({
      app: 'counter',
      props: z.object({ start: z.number().optional() }),
      events: { five: z.object({ count: z.number() }) },
      worker: workerEntry,
    });
    const Counter = islandComponent(contract);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const events: [string, unknown][] = [];
    const dispose = render(
      () => <Counter start={8} onEvent={(n: string, p: unknown) => events.push([n, p])} />,
      container,
    );
    await flush();
    await flush();
    const btn = container.querySelector('.inc')! as HTMLButtonElement;
    expect(btn.textContent).toBe('count 8');
    // non-shell props forward to the island as its props
    fireEvent.click(btn);
    await flush();
    expect(btn.textContent).toBe('count 9');
    dispose();
    expect(events).toEqual([]);
  });

  it('<Island/> component mounts and updates inside framework render', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onEvent = () => {};
    const dispose = render(
      () => (
        <Island
          worker={workerEntry}
          app="counter"
          props={{ start: 4 }}
          onEvent={onEvent}
        />
      ),
      container,
    );
    await flush();
    await flush();
    const btn = container.querySelector('.inc')! as HTMLButtonElement;
    expect(btn.textContent).toBe('count 4');
    fireEvent.click(btn);
    await flush();
    expect(container.querySelector('.inc')!.textContent).toBe('count 5');
    dispose();
  });
});
