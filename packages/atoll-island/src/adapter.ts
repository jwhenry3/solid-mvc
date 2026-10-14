/**
 * The framework renderer adapter — our `*-island` package's renderer half
 * (docs/atoll/islands-frameworks.md). `viewIslandApp(Component)` wraps a
 * `View` class or function component as a `RenderedIslandApp`; each mount
 * renders into the instance's proxy document via the Solid universal
 * renderer, so every DOM mutation serializes to an op.
 *
 *   // render.worker.ts
 *   export const worker = defineViewPolyWorker({
 *     apps: { counter: CounterView, clock: ClockView },
 *   });
 *
 * DI inside islands: the app gets a fresh root injector per instance —
 * worker-side injectables (stores, controllers) live in the worker, and
 * `@Component({ providers/imports/controllers })` metadata works unchanged
 * because the View host machinery runs in the worker too.
 *
 * Wire props arrive as getter-driven per-key signals: updateProps bumps
 * only the changed keys, so the DOM patch is exactly as fine-grained as
 * the reads — one utext/attr op per changed dependent, never a rebuild.
 */
import { createSignal } from 'solid-js';
import type { Setter } from 'solid-js';
import { Injector, InjectorContext, viewComponent, type Provider } from '@solid-mvc/core';
import {
  defineMonoWorker,
  definePolyWorker,
  islandApp,
  enterInstance,
  exitInstance,
  withContract,
  type ImperativeIslandApp,
  type IslandContract,
  type IslandWorkerDef,
  type RenderContext,
  type RenderedHandle,
  type RenderedIslandApp,
} from '@solid-mvc/atoll/worker';
import { createComponent, registerInstanceDoc, render } from './renderer';

/** Function components AND View classes — viewComponent() routes the
 *  class case to the View host. */
type AnyComponent =
  | ((props: Record<string, unknown>) => unknown)
  | (new (props: Record<string, unknown>) => { render(): unknown });

export interface ViewIslandAppOptions {
  /** Providers for the island's root injector — the island-side equivalent
   *  of `bootstrap(AppModule, providers)`. */
  providers?: Provider[];
  /** Attach a `defineIslandContract` contract: mount/updateProps props are
   *  validated against its schema, and declared `emit` payloads are
   *  checked worker-side. */
  contract?: IslandContract;
}

/** Wrap a View class or function component as a `RenderedIslandApp`. */
export function viewIslandApp(App: AnyComponent, opts?: ViewIslandAppOptions): RenderedIslandApp {
  const app: RenderedIslandApp = {
    renderer: 'solid-mvc',
    mount({ instance, doc, props }: RenderContext): RenderedHandle {
      const inj = new Injector(undefined, `island ${instance}`);
      for (const p of opts?.providers ?? []) inj.provide(p);
      registerInstanceDoc(doc, instance);

      // Per-key signal props: each props.foo read subscribes that key's
      // signal; updateProps sets only changed keys — fine-grained patches.
      const setters = new Map<string, Setter<unknown>>();
      const getters = new Map<string, () => unknown>();
      const ensureKey = (key: string): (() => unknown) => {
        let get = getters.get(key);
        if (get === undefined) {
          const [g, s] = createSignal<unknown>(undefined, { equals: false });
          getters.set(key, g);
          setters.set(key, s);
          get = g;
        }
        return get;
      };
      const propsProxy = new Proxy<Record<string, unknown>>({}, {
        get: (_t, key: string) => ensureKey(key)(),
        has: (_t, key) => key in current,
        ownKeys: () => Reflect.ownKeys(current),
        getOwnPropertyDescriptor: (_t, key) =>
          key in current
            ? { enumerable: true, configurable: true, get: () => ensureKey(key as string)() }
            : undefined,
      });
      let current: Record<string, unknown> = {};
      const applyProps = (p: Record<string, unknown>): void => {
        current = p;
        for (const [key, value] of Object.entries(p)) {
          ensureKey(key);
          setters.get(key)!(() => value);
        }
      };

      const resolvedApp = viewComponent(App);
      let disposeRoot: () => void = () => {};
      const prev = enterInstance(instance);
      try {
        applyProps(props);
        disposeRoot = render(
          () =>
            createComponent(InjectorContext.Provider, {
              value: inj,
              get children() {
                return createComponent(resolvedApp, propsProxy);
              },
            }),
          doc.body,
        );
      } finally {
        exitInstance(prev);
      }

      return {
        update: (p) => {
          const restore = enterInstance(instance);
          try {
            applyProps(p);
          } finally {
            exitInstance(restore);
          }
        },
        // The dispatch task's sync lane: run the event handler inside the
        // instance scope. Solid flushes signal effects synchronously, so
        // the DOM writes land in this task's op batch on their own —
        // nothing extra to flush.
        sync: (fn: () => void) => {
          const restore = enterInstance(instance);
          try {
            fn();
          } finally {
            exitInstance(restore);
          }
        },
        dispose: () => {
          const restore = enterInstance(instance);
          try {
            disposeRoot();
          } finally {
            exitInstance(restore);
            inj.deactivate();
          }
        },
      };
    },
  };
  // Propagate only an EXPLICIT stamp — islandAppNameOf would also mint one
  // from the class/function name, and bundlers suffix names
  // (RevenueChartIsland2), so a minted stamp can never match the registry
  // key and only trips definePolyWorker's stamp-vs-key warning. Bare
  // component refs still resolve by name fallback at mount time.
  const stamp = (App as { islandAppName?: unknown }).islandAppName;
  if (typeof stamp === 'string' && stamp !== '') {
    (app as { islandAppName?: string }).islandAppName = stamp;
  }
  return opts?.contract !== undefined ? withContract(opts.contract, app) : app;
}

/** Stamp + wrap in one step — `viewIsland('counter', CounterView)` yields
 *  both the registry value and the name the shell mounts by. */
export const viewIsland = (
  name: string,
  App: AnyComponent,
  opts?: ViewIslandAppOptions,
): RenderedIslandApp & { readonly islandAppName: string } =>
  islandApp(name, viewIslandApp(App, opts));

export interface ViewPolyWorkerRegistry {
  /** Name → component (or `{ imperative }` app / pre-wrapped app). Plain
   *  components pass through `viewIslandApp`. */
  apps: Record<string, AnyComponent | ImperativeIslandApp | RenderedIslandApp>;
}

/** `definePolyWorker` for framework views — maps each component in the
 *  registry through `viewIslandApp` and delegates. */
export function defineViewPolyWorker(registry: ViewPolyWorkerRegistry): IslandWorkerDef {
  const apps: Record<string, ImperativeIslandApp | RenderedIslandApp> = {};
  for (const [key, app] of Object.entries(registry.apps)) {
    apps[key] = typeof app === 'function' ? viewIslandApp(app) : app;
  }
  return definePolyWorker({ apps });
}

/** `defineMonoWorker` for a single framework view — the isolated-bundle
 *  host shape (own worker, own failure domain). */
export function defineViewMonoWorker(
  app: AnyComponent | ImperativeIslandApp | RenderedIslandApp,
  opts?: ViewIslandAppOptions,
): IslandWorkerDef {
  const resolved = typeof app === 'function' ? viewIslandApp(app, opts) : app;
  return defineMonoWorker(resolved);
}
