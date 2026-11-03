import { resolveRouteSync } from './lazy';
import { ROUTES, ROUTER_BASE, Router, defaultBasePath } from './router';
import type { Route } from './router';

export interface RouterOptions {
  /**
   * Mount prefix the app is served under ('/demo/'), Angular's APP_BASE_HREF.
   * Defaults to the document's own directory (document.baseURI), so apps
   * hosted under a subpath need no config; '/' disables prefixing.
   */
  basePath?: string;
}

// RouterModule.forRoot(routes) returns a module-shaped object — anything with
// __module metadata can sit in `imports`, so static config works the same as
// a decorated module class.
export class RouterModule {
  static forRoot(routes: Route[], opts: RouterOptions = {}) {
    return {
      __module: {
        providers: [
          { provide: ROUTES, useValue: routes },
          { provide: ROUTER_BASE, useValue: opts.basePath ?? defaultBasePath() },
          {
            provide: Router,
            useFactory: (r: Route[], base: string) => new Router(r, base),
            deps: [ROUTES, ROUTER_BASE],
          },
        ],
      },
    };
  }
}

// Resolve which view a matched route should render: an explicit component, or
// the module's declared bootstrap component.
export function routeComponent(match: { route: Route }): any {
  return resolveRouteSync(match.route).component;
}
