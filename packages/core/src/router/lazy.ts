import { signal } from '../signals';
import type { Signal } from '../signals';
import { getModuleMeta } from '../module';
import {
  lazyModuleReady,
  lazyStateOf,
  moduleRefOf,
  pickComponent,
  pickLazyFeature,
} from '../lazy';
import type { Route } from './router';

// Lazy route resolution. A route's `loadComponent` / `loadChildren` loaders
// are bundler split points (`() => import('./x')`); their results resolve
// through metadata stamps, not conventions:
//
//   loadComponent  -> a View subclass, a @Component-stamped class, or a
//                     function component (default export, or .then(m => m.X))
//   loadChildren   -> an @Module class (or __module-shaped object — renders
//                     its bootstrap view inside the module injector) or a
//                     Route[] spliced in as this route's children
//
// Resolution is cached per Route object: the first match or render kicks the
// loader, and every later navigation reuses the settled value. The same
// stamps back lazyView/lazyModule (../lazy.ts) — facade components usable
// in `component`/`module` fields and straight in JSX alike.
//
// The DOM tree never sees a Route[] land directly: a loadChildren route's
// route def carries a splat-tail child that matches any deeper URL, and the
// tail's frame re-runs the service matcher over the resolved children when
// the chunk arrives (see router-dom.ts).

export interface RouteResolution {
  /** The view/component this route renders at its depth (null = componentless
   *  wrapper — the outlet passes through to the next depth). */
  component: any;
  /** Module whose injector scopes this level (its bootstrap view is the
   *  fallback component). */
  module?: any;
  /** Child routes — static `children`, or a Route[] resolved by loadChildren. */
  children?: Route[];
}

export type LazyRouteState =
  | { status: 'loading' }
  | { status: 'ready'; resolved: RouteResolution }
  | { status: 'error'; error: unknown };

export function isLazyRoute(route: Route): boolean {
  return !!(route.loadComponent || route.loadChildren);
}

/** Sync resolution — what the route's static fields already know. Used for
 *  eager routes and as the render answer while a lazy route's chunk loads
 *  (an eager shell mounts immediately; its lazy children extend the match).
 *  A `module: lazyModule(...)` field reads the facade's resource: pending
 *  resolves to no module yet, and the read subscribes the outlet so 'ready'
 *  swaps the real module in. */
export function resolveRouteSync(route: Route): RouteResolution {
  const mod = moduleRefOf(route.module);
  return {
    component: route.component ?? getModuleMeta(mod)?.bootstrap?.[0] ?? null,
    module: mod,
    children: route.children,
  };
}

/**
 * True while the route's own render target is still resolving — powers
 * `router.pending` and the outlet's `fallback`. Only matched routes are
 * asked, so the reads merely subscribe work the outlet would kick anyway.
 */
export function routePending(route: Route): boolean {
  if (isLazyRoute(route) && lazyRouteState(route).value.status === 'loading') {
    return true;
  }
  return (
    lazyStateOf(route.component)?.status === 'loading' ||
    lazyStateOf(route.module)?.status === 'loading'
  );
}

/**
 * True while a matched route's `loadChildren` is holding back deeper
 * matches — the pending match alone ends the chain, so an outlet sitting
 * one depth past it is where the loaded child will appear. Mirrors the
 * condition matching uses before consulting the resolution signal.
 */
export function routeChildPending(route: Route): boolean {
  return (
    !route.children?.length &&
    !!route.loadChildren &&
    lazyRouteState(route).value.status === 'loading'
  );
}

const states = new WeakMap<Route, Signal<LazyRouteState>>();

/**
 * Per-route resolution state. First call kicks the loaders; the signal flips
 * to 'ready'/'error' when they settle — `router.matches` re-runs because
 * matching reads it for `loadChildren`, and outlets re-render on read.
 */
export function lazyRouteState(route: Route): Signal<LazyRouteState> {
  let s = states.get(route);
  if (!s) {
    s = signal<LazyRouteState>({ status: 'loading' });
    states.set(route, s);
    resolveLazyRoute(route).then(
      (resolved) => {
        s!.value = { status: 'ready', resolved };
      },
      (error) => {
        console.error(`[framework] lazy route '${route.path}' failed to load:`, error);
        s!.value = { status: 'error', error };
      },
    );
  }
  return s;
}

async function resolveLazyRoute(route: Route): Promise<RouteResolution> {
  const lazyMod = lazyModuleReady(route.module);
  const [feature, comp, awaitedMod] = await Promise.all([
    route.loadChildren ? route.loadChildren() : undefined,
    route.loadComponent ? route.loadComponent() : undefined,
    lazyMod ?? undefined,
  ]);
  let mod = lazyMod ? awaitedMod : route.module;
  let children = route.children;
  if (route.loadChildren) {
    const picked = pickLazyFeature(feature, `loadChildren for route '${route.path}'`);
    if (Array.isArray(picked)) {
      if (!children?.length) children = picked;
    } else {
      mod ??= picked;
    }
  }
  const component =
    route.component ??
    (route.loadComponent ? pickComponent(comp, `loadComponent for route '${route.path}'`) : undefined) ??
    getModuleMeta(mod)?.bootstrap?.[0] ??
    null;
  return { component, module: mod, children };
}
