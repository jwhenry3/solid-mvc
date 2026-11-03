/**
 * The DOM-side router mount — the ONLY file allowed to import
 * @solidjs/router statically. Its `lifecycle` module touches
 * `window.history` at eval, so a static import anywhere in the
 * `@solid-mvc/core` barrel would crash DOM-free worker realms. This file
 * is pulled in via dynamic import when a root <RouterOutlet/> mounts,
 * which worker islands never do.
 */
import { createComponent, createMemo, onCleanup, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  Router as SolidRouter,
  useCurrentMatches,
  useLocation,
  useNavigate,
} from '@solidjs/router';
import type { RouteDefinition, RouteSectionProps } from '@solidjs/router';
import { useInjector, useService, InjectorContext } from '../context';
import { getModuleInjector } from '../module';
import { lazyStateOf } from '../lazy';
import { isLazyRoute, lazyRouteState, resolveRouteSync } from './lazy';
import {
  LAZY_TAIL_KEY,
  LAZY_TAIL_PARAM,
  matchSegments,
  ROUTE_INFO_KEY,
  Router,
} from './router';
import type { Route, RouteMatch } from './router';
import { viewComponent } from '../view';
import { OutletDepth, OutletChildren, OutletFallback } from './outlet';

/**
 * Wraps the @solidjs/router tree's content (the `root` prop): captures
 * the live location/navigator/matches and feeds them to the Router
 * service, so `router.url`/`router.matches`/`navigate()` track it.
 */
function RouterBridge(props: RouteSectionProps): JSX.Element {
  const router = useService(Router);
  router.attachRouter(useNavigate(), useLocation(), useCurrentMatches());
  onCleanup(() => router.detachRouter());
  return props.children;
}

/**
 * The component @solidjs/router mounts for a matched route: swaps in the
 * route module's injector (getModuleInjector caches per parent), bumps
 * the outlet depth, and hands the router's child element to any nested
 * <RouterOutlet/> through OutletChildren. A route with no view of its
 * own (pure grouping) passes the children straight through.
 *
 * Lazy routes resolve through the per-route signal: 'ready' swaps in the
 * resolved component/module/children, and while the route's own render
 * target is in flight the outlet's fallback (OutletFallback) renders
 * instead — an eager shell under a pending loadChildren is NOT pending,
 * it renders now and the deeper outlet's fallback covers the tail.
 */
function RouteFrame(props: RouteSectionProps, route: Route): JSX.Element {
  const depth = useContext(OutletDepth);
  const parent = useInjector();
  const fallback = useContext(OutletFallback);
  const resolved = createMemo(() => {
    const st = isLazyRoute(route) ? lazyRouteState(route).value : null;
    return st?.status === 'ready' ? st.resolved : resolveRouteSync(route);
  });
  const Comp = () => resolved().component;
  const mod = () => resolved().module;
  const pending = () =>
    (isLazyRoute(route) &&
      lazyRouteState(route).value.status === 'loading' &&
      !Comp() &&
      !mod()) ||
    lazyStateOf(Comp())?.status === 'loading' ||
    lazyStateOf(route.module)?.status === 'loading';
  return createComponent(OutletDepth.Provider, {
    value: depth + 1,
    get children() {
      return createComponent(OutletChildren.Provider, {
        value: () => props.children,
        get children() {
          if (pending()) return fallback;
          const C = Comp();
          return C
            ? createComponent(InjectorContext.Provider, {
                value: mod() ? getModuleInjector(mod(), parent) : parent,
                get children() {
                  return createComponent(viewComponent(C), {});
                },
              })
            : props.children;
        },
      });
    },
  });
}

/**
 * The splat-tail frame under a loadChildren route — the wire matcher gives
 * it the unmatched remainder, and once the chunk lands the service matcher
 * continues into the resolved Route[] (an @Module result needs no tail:
 * the parent route's own resolution already covers it). While the load is
 * in flight the enclosing outlet's fallback marks the spot.
 */
function LazyTailFrame(props: RouteSectionProps, route: Route): JSX.Element {
  const fallback = useContext(OutletFallback);
  return createMemo(() => {
    const st = lazyRouteState(route).value;
    if (st.status === 'ready' && st.resolved.children?.length) {
      const rest = props.params[LAZY_TAIL_PARAM] ?? '';
      const chain = matchSegments(
        st.resolved.children,
        rest.split('/').filter(Boolean),
      );
      if (chain) return renderChain(chain, props.children);
    }
    return st.status === 'loading' ? fallback : null;
  }) as unknown as JSX.Element;
}

/**
 * Render a service-matched continuation as nested RouteFrames — each gets
 * the same injector/depth/outlet wiring the wire frames have, with the
 * innermost frame holding the element the wire matched below the splat.
 */
function renderChain(chain: RouteMatch[], leaf: JSX.Element): JSX.Element {
  let el = leaf;
  for (let i = chain.length - 1; i >= 0; i--) {
    const inner = el;
    el = RouteFrame({ children: inner } as RouteSectionProps, chain[i].route);
  }
  return el;
}

/** Framework Route → @solidjs/router RouteDefinition (children recurse). */
function toRouteDef(route: Route): RouteDefinition {
  const children = route.children?.length ? route.children.map(toRouteDef) : [];
  if (!route.children?.length && route.loadChildren) {
    // The wire matcher cannot know the lazy children — a splat tail claims
    // any deeper URL under this route, and its frame continues the match
    // service-side once the chunk lands.
    children.push({
      path: `*${LAZY_TAIL_PARAM}`,
      info: { [LAZY_TAIL_KEY]: route },
      component: (props: RouteSectionProps) => LazyTailFrame(props, route),
    });
  }
  return {
    path: route.path,
    info: { [ROUTE_INFO_KEY]: route },
    component: (props: RouteSectionProps) => RouteFrame(props, route),
    children: children.length ? children : undefined,
  };
}

/** Mounts the @solidjs/router tree for the service's route table. */
export function DomRouter(props: { router: Router }): JSX.Element {
  const defs = props.router.routeTable.map(toRouteDef);
  return createComponent(SolidRouter, {
    base: props.router.base,
    root: RouterBridge,
    children: defs,
  }) as unknown as JSX.Element;
}
