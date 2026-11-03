import { createComponent, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { signal } from './signals';
import type { Signal } from './signals';
import { InjectorContext, useInjector } from './context';
import { getModuleInjector, getModuleMeta } from './module';
import { isViewClass, viewComponent } from './view';

// Lazy loading for views and modules — usable in route configs AND straight
// in JSX. lazyView/lazyModule wrap a bundler split point (() => import(...))
// in a component facade that defers the load until first mount, caches the
// settled value, and renders nothing until it lands. Resolution is by
// metadata stamp, not convention: `default` export first, then named exports
// scanned for __module / __component / View-subclass / Route[] shapes.

export type LazyResourceState<R> =
  | { status: 'loading' }
  | { status: 'ready'; value: R }
  | { status: 'error'; error: unknown };

/**
 * A deferred loader. `.state` reads kick the import on first access and
 * subscribe the reader (a component render or a computed); `.ready` is the
 * same resolution as a promise.
 */
export interface LazyResource<R> {
  readonly state: LazyResourceState<R>;
  readonly ready: Promise<R>;
}

function lazyResource<R>(run: () => Promise<R>, label: string): LazyResource<R> {
  let s: Signal<LazyResourceState<R>> | undefined;
  let promise: Promise<R> | undefined;
  const start = () => {
    if (!s) {
      s = signal<LazyResourceState<R>>({ status: 'loading' });
      promise = run().then(
        (value) => {
          s!.value = { status: 'ready', value };
          return value;
        },
        (error) => {
          console.error(`[framework] ${label} failed to load:`, error);
          s!.value = { status: 'error', error };
          throw error;
        },
      );
      // The state object carries failures to renderers; keep the promise
      // from also reporting an unhandled rejection.
      promise.catch(() => {});
    }
    return { s: s!, promise: promise! };
  };
  return {
    get state() {
      return start().s.value;
    },
    get ready() {
      return start().promise;
    },
  };
}

// --- Export pickers ---------------------------------------------------------
// A lazy import resolves to: the ES module namespace ({ default: X, Y }),
// a value picked by .then(m => m.X), or a bare Route[]. Candidates are
// ordered default-first so `export default` always wins.

function exportCandidates(ns: any): any[] {
  if (Array.isArray(ns) || typeof ns !== 'object' || ns === null) return [ns];
  return 'default' in ns ? [ns.default, ...Object.values(ns)] : Object.values(ns);
}

export function isComponent(v: any): boolean {
  return (
    typeof v === 'function' &&
    (isViewClass(v) || !!v.__component || !!v.__lazyView)
  );
}

export function pickComponent(ns: any, label: string): any {
  for (const c of exportCandidates(ns)) {
    if (isComponent(c)) return c;
  }
  // Unstamped function components resolve only where unambiguous: the
  // loader's direct return value (.then(m => m.X)) or a default export.
  if (typeof ns === 'function') return ns;
  if (typeof ns === 'object' && ns !== null && typeof ns.default === 'function') {
    return ns.default;
  }
  throw new Error(
    `${label} resolved no view — expected a View class, @Component class, ` +
      `or function component (default export or .then(m => m.X))`,
  );
}

export function pickLazyFeature(ns: any, label: string): any {
  for (const c of exportCandidates(ns)) {
    if (getModuleMeta(c) || Array.isArray(c)) return c;
  }
  throw new Error(
    `${label} resolved no feature — expected the module to export an ` +
      `@Module class or a Route[] (default or named export)`,
  );
}

export function pickModule(ns: any, label: string): any {
  const v = pickLazyFeature(ns, label);
  if (Array.isArray(v)) {
    throw new Error(`${label} resolved a Route[] — expected an @Module class`);
  }
  return v;
}

// --- Facades ----------------------------------------------------------------

/**
 * `lazyView(() => import('./hello.view'))` — a lazy standalone component.
 * Usable as a Route `component` or directly in JSX: the facade suspends on
 * the import, then mounts the resolved view with the same props.
 */
export function lazyView(load: () => Promise<any>): (props: any) => JSX.Element {
  const res = lazyResource(
    () => load().then((ns) => pickComponent(ns, 'lazyView')),
    'lazyView',
  );
  const LazyView = (props: any) => {
    const { fallback, ...rest } = props;
    return createMemo(() => {
      const st = res.state;
      if (st.status === 'ready') return createComponent(viewComponent(st.value), rest);
      return st.status === 'loading' ? ((fallback ?? null) as JSX.Element) : null;
    }) as unknown as JSX.Element;
  };
  (LazyView as any).__lazyView = res;
  (LazyView as any).displayName = 'LazyView';
  return LazyView;
}

/**
 * `lazyModule(() => import('./admin.module'))` — a lazy feature module.
 * Usable as a Route `module` (the outlet resolves the real module and its
 * injector) or `component`, or directly in JSX: mounts the module's
 * bootstrap view inside the module injector once the chunk lands.
 */
export function lazyModule(load: () => Promise<any>): (props: any) => JSX.Element {
  const res = lazyResource(
    () => load().then((ns) => pickModule(ns, 'lazyModule')),
    'lazyModule',
  );
  const LazyModule = (props: any) => {
    const { fallback, ...rest } = props;
    const parent = useInjector();
    return createMemo(() => {
      const st = res.state;
      const mod = st.status === 'ready' ? st.value : undefined;
      const Boot = mod ? getModuleMeta(mod)?.bootstrap?.[0] : null;
      if (!Boot) return st.status === 'loading' ? ((fallback ?? null) as JSX.Element) : null;
      const inj = getModuleInjector(mod, parent);
      return createComponent(InjectorContext.Provider, {
        value: inj,
        get children() {
          return createComponent(viewComponent(Boot), rest);
        },
      });
    }) as unknown as JSX.Element;
  };
  (LazyModule as any).__lazyModule = res;
  (LazyModule as any).displayName = 'LazyModule';
  return LazyModule;
}

// --- Route-field integration -------------------------------------------------

/**
 * Read a lazyView/lazyModule facade's resource state — kicks the loader on
 * first read and subscribes the reader (outlet render, router.pending
 * computed). Non-facade values answer null.
 */
export function lazyStateOf(v: any): LazyResourceState<any> | null {
  const res = typeof v === 'function' ? v.__lazyView ?? v.__lazyModule : null;
  return res ? (res as LazyResource<any>).state : null;
}

/**
 * Sync unwrap for the Route `module` field: a lazyModule facade answers
 * with the resolved module class once loaded (undefined while pending or
 * after a failure). Reading the resource state subscribes the caller.
 */
export function moduleRefOf(m: any): any {
  if (typeof m === 'function' && m.__lazyModule) {
    const st = (m.__lazyModule as LazyResource<any>).state;
    return st.status === 'ready' ? st.value : undefined;
  }
  return m;
}

/** Async unwrap — awaits the ref's own resolution (kicking it if needed). */
export function lazyModuleReady(m: any): Promise<any> | null {
  return typeof m === 'function' && m.__lazyModule
    ? (m.__lazyModule as LazyResource<any>).ready
    : null;
}
