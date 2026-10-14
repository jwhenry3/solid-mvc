/**
 * The DOM-side router mount — the ONLY file allowed to import
 * @solidjs/router statically. Its `lifecycle` module touches
 * `window.history` at eval, so a static import anywhere in the
 * `@solid-mvc/core` barrel would crash DOM-free worker realms. This file
 * is pulled in via dynamic import when a root <RouterOutlet/> mounts,
 * which worker islands never do.
 */
import { createComponent, onCleanup, useContext } from 'solid-js';
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
import { routeComponent } from './module';
import { ROUTE_INFO_KEY, Router } from './router';
import { viewComponent } from '../view';
import { OutletDepth, OutletChildren } from './outlet';
import type { Route } from './router';

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
 */
function RouteFrame(props: RouteSectionProps, route: Route): JSX.Element {
  const depth = useContext(OutletDepth);
  const parent = useInjector();
  const injector = route.module ? getModuleInjector(route.module, parent) : parent;
  const Comp = routeComponent({ route });
  return createComponent(OutletDepth.Provider, {
    value: depth + 1,
    get children() {
      return createComponent(OutletChildren.Provider, {
        value: () => props.children,
        get children() {
          return Comp
            ? createComponent(InjectorContext.Provider, {
                value: injector,
                get children() {
                  return createComponent(viewComponent(Comp), {});
                },
              })
            : props.children;
        },
      });
    },
  });
}

/** Framework Route → @solidjs/router RouteDefinition (children recurse). */
function toRouteDef(route: Route): RouteDefinition {
  return {
    path: route.path,
    info: { [ROUTE_INFO_KEY]: route },
    component: (props: RouteSectionProps) => RouteFrame(props, route),
    children: route.children?.length ? route.children.map(toRouteDef) : undefined,
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
