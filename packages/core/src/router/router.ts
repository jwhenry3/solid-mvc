import { createEffect } from 'solid-js';
import type { Location, Navigator, RouteMatch as WireRouteMatch } from '@solidjs/router';
import { computed, signal } from '../signals';
import { Injectable } from '../decorators';
import { InjectionToken } from '../injector';

export interface Route {
  path: string;
  component?: any; // view function
  module?: any; // module class — its bootstrap component renders inside its injector
  children?: Route[];
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

export const ROUTES = new InjectionToken<Route[]>('ROUTES');
export const ROUTER_BASE = new InjectionToken<string>('ROUTER_BASE');

/**
 * The directory the app's document lives at, e.g. '/demo/' when the page is
 * served from `host/demo/index.html`. Deriving the base from baseURI (rather
 * than baking it at build time) means the same bundle works under any mount
 * path — GitHub Pages project dirs, reverse-proxy prefixes, iframed demos.
 */
export function defaultBasePath(): string {
  if (typeof document === 'undefined') return '/';
  const p = new URL(document.baseURI).pathname;
  return p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
}

/**
 * Prefix match: consume the pattern's leading segments off `segs`, returning
 * the captured params and the unconsumed tail. `'*'` consumes everything;
 * `''` consumes nothing (an index route — leaf check decides validity).
 */
function matchPrefix(
  pattern: string,
  segs: string[],
): { params: Record<string, string>; rest: string[] } | null {
  if (pattern === '*') return { params: {}, rest: [] };
  const pSegs = pattern.split('/').filter(Boolean);
  if (pSegs.length > segs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pSegs.length; i++) {
    const p = pSegs[i];
    const u = decodeURIComponent(segs[i]);
    if (p.startsWith(':')) params[p.slice(1)] = u;
    else if (p !== u) return null;
  }
  return { params, rest: segs.slice(pSegs.length) };
}

/**
 * Match `segs` against a route list into a chain outermost → innermost.
 * A route with `children` matches by prefix and the tail recurses; a leaf
 * route must consume the whole tail. Parents may match alone when the tail
 * is exhausted (Angular semantics: `/users` renders the parent shell even
 * if it has children).
 */
function matchSegments(routes: Route[], segs: string[]): RouteMatch[] | null {
  for (const route of routes) {
    const m = matchPrefix(route.path, segs);
    if (m === null) continue;
    if (route.children?.length) {
      const child = matchSegments(route.children, m.rest);
      if (child !== null) return [{ route, params: m.params }, ...child];
      if (m.rest.length === 0) return [{ route, params: m.params }];
      continue;
    }
    if (m.rest.length === 0) return [{ route, params: m.params }];
  }
  return null;
}

function matchRoutes(routes: Route[], url: string): RouteMatch[] | null {
  const path = url.split('?')[0].split('#')[0];
  return matchSegments(routes, path.split('/').filter(Boolean));
}

/** Key under which each framework `Route` rides on its RouteDefinition's
 *  `info`, so wire matches can map back to the configured route. */
export const ROUTE_INFO_KEY = 'smvcRoute';

function decodeParams(params: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

@Injectable()
export class Router {
  /** Mount prefix, normalized to '' or '/demo' (no trailing slash). */
  readonly base: string;
  url = signal(typeof location === 'undefined' ? '/' : '');
  /**
   * The match chain reported by the mounted @solidjs/router tree — null
   * until a root <RouterOutlet/> mounts it (standalone Routers, views
   * outside any outlet, worker realms). In that case `matches` falls back
   * to the service-side matcher, which shares the same semantics.
   */
  private wireMatches = signal<RouteMatch[] | null>(null);
  private navigator: Navigator | null = null;
  /**
   * The matched chain outermost → innermost — depth d is what the d-th
   * nested <RouterOutlet/> renders.
   */
  matches = computed(() => this.wireMatches.value ?? matchRoutes(this.routes, this.url.value!));
  /** Back-compat: the chain's outermost match. */
  match = computed(() => this.matches.value?.[0] ?? null);
  /** Params merged across the whole chain (inner levels win on collision). */
  params = computed(() =>
    Object.assign({}, ...(this.matches.value ?? []).map((m) => m.params)),
  );

  constructor(
    private routes: Route[],
    base = defaultBasePath(),
  ) {
    this.base = base === '/' ? '' : base.replace(/\/+$/, '');
    this.consumeShimParam();
    if (typeof location !== 'undefined') {
      this.url.value = this.strip(location.pathname) + location.search;
    }
    // Plain popstate tracking — the mounted @solidjs/router also observes
    // it and feeds this signal through the bridge; this keeps standalone
    // Routers (no outlet mounted) in sync too.
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState);
    }
  }

  /** The configured route table — the root outlet maps it to defs. */
  get routeTable(): Route[] {
    return this.routes;
  }

  /**
   * Static-host deep links: the site's 404 shim redirects
   * `/docs/<app>/<rest>` to `<app>/?__smvc_path=<rest>` so the app loads;
   * restore the real URL via replaceState before seeding `url` — the
   * browser history never sees the hop. No-op everywhere else.
   */
  private consumeShimParam(): void {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    const rest = new URL(location.href).searchParams.get('__smvc_path');
    if (rest === null) return;
    history.replaceState(null, '', this.base + '/' + rest);
  }

  private strip(path: string): string {
    if (this.base && path.startsWith(this.base)) {
      return path.slice(this.base.length) || '/';
    }
    return path;
  }

  /** Absolute href for an in-app path — what <a href> and pushState see. */
  href(to: string): string {
    return this.base + to;
  }

  /** Feed a URL change into the router — popstate, the bridge, or anything
   *  else observing location. */
  syncUrl(fullUrl: string): void {
    const [path, search = ''] = fullUrl.split('?');
    const stripped = this.strip(path);
    const next = stripped + (search ? `?${search}` : '');
    if (next !== this.url.value) this.url.value = next;
  }

  private onPopState = () => {
    this.syncUrl(location.pathname + location.search);
  };

  /** Bound to injector deactivate — drops the global listener. */
  onDestroy = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.onPopState);
    }
  };

  navigate(to: string): void {
    const nav = this.navigator;
    if (nav) {
      // @solidjs/router settles navigation on its transition lane — url,
      // history, and matches update asynchronously via the bridge.
      nav(to);
      return;
    }
    // No Router tree mounted — standalone service semantics (sync).
    if (typeof history !== 'undefined') history.pushState(null, '', this.base + to);
    this.url.value = to;
  }

  isActive(path: string): boolean {
    return this.url.value === path;
  }

  /**
   * Called once by the root outlet's bridge component — the live
   * @solidjs/router context becomes the source for `url`/`matches`, and
   * `navigate` delegates to its navigator (scroll, transitions, anchors).
   */
  attachRouter(
    navigator: Navigator,
    loc: Location,
    currentMatches: () => WireRouteMatch[],
  ): void {
    this.navigator = navigator;
    createEffect(() => {
      this.syncUrl(loc.pathname + loc.search);
      const wire = currentMatches();
      this.wireMatches.value = wire.map((m) => ({
        route: (m.route.info?.[ROUTE_INFO_KEY] as Route | undefined) ?? {
          path: m.route.originalPath,
        },
        params: decodeParams(m.params),
      }));
    });
  }

  /** Clear the wiring when the Router tree disposes. */
  detachRouter(): void {
    this.navigator = null;
    this.wireMatches.value = null;
  }
}
