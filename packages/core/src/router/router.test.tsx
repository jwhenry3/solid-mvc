import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach } from 'vitest';
import { Injector } from '../injector';
import { inject } from '../injector';
import { InjectorContext } from '../context';
import { Router, ROUTES } from './router';
import { createRoot } from 'solid-js';
import { RouterModule, routeComponent } from './module';
import { RouterOutlet } from './outlet';
import { Link } from './link';
import { createModuleInjector } from '../module';
import { Module } from '../decorators';
import { View } from '../view';
import type { Route } from './router';
import type { Location as RouterLocation } from '@solidjs/router';

afterEach(() => cleanup());

// @solidjs/router settles navigations on its transition lane — url,
// history, and outlet content land a tick after navigate()/clicks.
const settle = () => new Promise((r) => setTimeout(r));

const routes: Route[] = [
  { path: '/', component: () => <p>home</p> },
  { path: '/user/:id', component: () => <p>user</p> },
  { path: '*', component: () => <p>not found</p> },
];

function makeRouter(rs: Route[] = routes) {
  // Explicit '/' base — document.baseURI tracks earlier tests' pushState
  // calls, so the default would inherit a stale mount dir.
  return new Router(rs, '/');
}

describe('route matching', () => {
  it('matches exact paths and captures :params', () => {
    const r = makeRouter();
    r.url.value = '/user/42';
    expect(r.match.value?.params.id).toBe('42');
  });

  it('decodes URI components in params', () => {
    const r = makeRouter();
    r.url.value = '/user/a%20b';
    expect(r.match.value?.params.id).toBe('a b');
  });

  it('falls back to * wildcard and returns null when nothing matches', () => {
    const r = makeRouter();
    r.url.value = '/anything';
    expect(r.match.value?.route.path).toBe('*');
    const noWild = new Router([{ path: '/only', component: () => null }], '/');
    noWild.url.value = '/other';
    expect(noWild.match.value).toBeNull();
  });

  it('exposes params as a computed signal', () => {
    const r = makeRouter();
    r.url.value = '/user/7';
    expect(r.params.value.id).toBe('7');
  });
});

describe('nested routes', () => {
  const nested: Route[] = [
    {
      path: '/users',
      component: () => (
        <p>
          users shell <RouterOutlet />
        </p>
      ),
      children: [
        // Static keys outrank params by config order — same rule as flat lists.
        { path: 'new', component: () => <p>new user</p> },
        { path: ':id', component: () => <p>user detail</p> },
      ],
    },
    { path: '/org/:org', component: () => <p>org</p>, children: [{ path: 'team/:team', component: () => <p>team</p> }] },
    { path: '*', component: () => <p>not found</p> },
  ];

  it('matches a chain and merges params across levels', () => {
    const r = makeRouter(nested);
    r.url.value = '/org/acme/team/eng';
    const chain = r.matches.value!;
    expect(chain).toHaveLength(2);
    expect(chain[0].route.path).toBe('/org/:org');
    expect(chain[1].route.path).toBe('team/:team');
    expect(r.params.value).toEqual({ org: 'acme', team: 'eng' });
  });

  it('matches a parent alone when the tail is exhausted', () => {
    const r = makeRouter(nested);
    r.url.value = '/users';
    expect(r.matches.value).toHaveLength(1);
    expect(r.matches.value![0].route.path).toBe('/users');
  });

  it('prefers static child keys over params by config order', () => {
    const r = makeRouter(nested);
    r.url.value = '/users/new';
    expect(r.matches.value![1].route.path).toBe('new');
  });

  it('falls through to * when no child claims the tail', () => {
    const r = makeRouter(nested);
    r.url.value = '/users/1/extra';
    expect(r.match.value?.route.path).toBe('*');
  });

  it('nested <RouterOutlet/> renders the child match by depth', async () => {
    const M = RouterModule.forRoot(nested, { basePath: '/' });
    const root = new Injector();
    const inj = createModuleInjector(M, root);
    history.pushState(null, '', '/users/42');
    const router = inj.get(Router);
    router.url.value = '/users/42';
    render(() => (
      <InjectorContext.Provider value={inj}>
        <RouterOutlet />
      </InjectorContext.Provider>
    ));
    expect(await screen.findByText('user detail', { exact: false })).toBeTruthy();
    // The parent shell renders too — outlets nest, not replace.
    expect(screen.getByText(/users shell/)).toBeTruthy();
  });
});

describe('navigation', () => {
  it('navigate() updates the url signal and browser history', () => {
    const r = makeRouter();
    r.navigate('/user/5');
    expect(r.url.value).toBe('/user/5');
    expect(location.pathname).toBe('/user/5');
  });

  it('navigate() updates the outlet content too', async () => {
    const M = RouterModule.forRoot(routes, { basePath: '/' });
    const root = new Injector();
    const inj = createModuleInjector(M, root);
    history.pushState(null, '', '/');
    const router = inj.get(Router);
    router.url.value = '/';
    render(() => (
      <InjectorContext.Provider value={inj}>
        <RouterOutlet />
      </InjectorContext.Provider>
    ));
    router.navigate('/user/7');
    await settle();
    expect(router.url.value).toBe('/user/7');
    expect(location.pathname).toBe('/user/7');
    expect(await screen.findByText('user')).toBeTruthy();
  });

  it('intercepts plain <a href> clicks anywhere in the document', async () => {
    // @solidjs/router installs a document-level interceptor: unmodified
    // same-origin anchors navigate in-app without a reload — including
    // anchors the framework didn't render.
    const M = RouterModule.forRoot(routes, { basePath: '/' });
    const root = new Injector();
    const inj = createModuleInjector(M, root);
    history.pushState(null, '', '/');
    const router = inj.get(Router);
    router.url.value = '/';
    render(() => (
      <InjectorContext.Provider value={inj}>
        <a href="/user/11">foreign link</a>
        <RouterOutlet />
      </InjectorContext.Provider>
    ));
    // The Router tree (and its document-level interceptor) mounts a tick
    // after the outlet — the DOM-side module loads via dynamic import so
    // worker bundles never pull @solidjs/router's window-touching eval.
    await settle();
    fireEvent.click(screen.getByText('foreign link'));
    await settle();
    expect(router.url.value).toBe('/user/11');
    expect(location.pathname).toBe('/user/11');
    expect(await screen.findByText('user')).toBeTruthy();
  });

  it('syncs url on popstate', () => {
    const r = makeRouter();
    history.pushState(null, '', '/user/9');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(r.url.value).toBe('/user/9');
  });

  it('stops syncing popstate after onDestroy', () => {
    history.pushState(null, '', '/');
    const r = makeRouter();
    r.onDestroy();
    history.pushState(null, '', '/user/9');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(r.url.value).not.toBe('/user/9');
    history.pushState(null, '', '/');
  });

  it('isActive compares the url signal', () => {
    const r = makeRouter();
    r.url.value = '/user/3';
    expect(r.isActive('/user/3')).toBe(true);
    expect(r.isActive('/')).toBe(false);
  });
});

describe('RouterOutlet', () => {
  function outletWith(module: any, initial = '/') {
    const root = new Injector();
    const inj = createModuleInjector(module, root);
    history.pushState(null, '', initial);
    // Router is constructed lazily; force url sync after pushState.
    const router = inj.get(Router);
    router.url.value = location.pathname;
    return {
      inj,
      router,
      ...render(() => (
        <InjectorContext.Provider value={inj}>
          <RouterOutlet />
        </InjectorContext.Provider>
      )),
    };
  }

  it('renders the matched route component', async () => {
    const M = RouterModule.forRoot(routes, { basePath: '/' });
    outletWith(M, '/user/3');
    expect(await screen.findByText('user')).toBeTruthy();
  });

  it('mounts module routes inside the module injector', async () => {
    class FeatureSvc {
      name = 'feature-scoped';
    }
    class FeatureView extends View {
      s = inject(FeatureSvc);
      render() {
        return <p>{this.s.name}</p>;
      }
    }
    @Module({ providers: [FeatureSvc], components: [FeatureView], bootstrap: [FeatureView] })
    class FeatureMod {}
    const M = {
      __module: {
        imports: [
          // Explicit base — @solidjs/router only matches URLs under the
          // configured base, so an ambient baseURI left by earlier tests
          // would shadow '/f'.
          RouterModule.forRoot([{ path: '/f', module: FeatureMod }], { basePath: '/' }),
        ],
      },
    };
    outletWith(M, '/f');
    expect(await screen.findByText('feature-scoped')).toBeTruthy();
  });

  it('routeComponent prefers an explicit component over module bootstrap', () => {
    const C = () => null;
    const match = { route: { path: '/x', component: C } };
    expect(routeComponent(match)).toBe(C);
  });

  it('routeComponent returns null for grouping routes and module-less modules', () => {
    // A route with neither component nor module renders its children only.
    expect(routeComponent({ route: { path: '/g' } })).toBeNull();
    // A module route whose module declares no bootstrap resolves null too.
    class Empty {}
    expect(routeComponent({ route: { path: '/m', module: Empty } })).toBeNull();
  });

  it('grouping routes pass their matched children straight through', async () => {
    const grouped: Route[] = [
      {
        path: '/wrap',
        children: [{ path: 'leaf', component: () => <p>leaf content</p> }],
      },
      { path: '*', component: () => <p>not found</p> },
    ];
    const M = RouterModule.forRoot(grouped, { basePath: '/' });
    outletWith(M, '/wrap/leaf');
    expect(await screen.findByText('leaf content')).toBeTruthy();
  });
});

describe('base path', () => {
  it('strips the mount prefix when reading location and matches routes', () => {
    const r = new Router(routes, '/demo/');
    history.pushState(null, '', '/demo/user/8');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(r.url.value).toBe('/user/8');
    expect(r.match.value?.params.id).toBe('8');
  });

  it('normalizes the base and defaults it from document.baseURI', () => {
    expect(new Router(routes, '/demo/').base).toBe('/demo');
    expect(new Router(routes, '/').base).toBe('');
    // At the document root the default derivation yields no prefix.
    history.pushState(null, '', '/');
    expect(new Router(routes).base).toBe('');
    // And under a mount dir it yields that dir.
    history.pushState(null, '', '/docs/demo/');
    expect(new Router(routes).base).toBe('/docs/demo');
    history.pushState(null, '', '/');
  });

  it('prepends the base on navigate() and href()', () => {
    const r = new Router(routes, '/demo/');
    r.navigate('/user/2');
    expect(location.pathname).toBe('/demo/user/2');
    expect(r.url.value).toBe('/user/2');
    expect(r.href('/user/2')).toBe('/demo/user/2');
    history.pushState(null, '', '/');
  });

  it('forRoot accepts an explicit basePath', () => {
    const M = RouterModule.forRoot(routes, { basePath: '/app/' });
    const inj = createModuleInjector(M, new Injector());
    expect(inj.get(Router).base).toBe('/app');
  });

  it('restores a static-host deep link from the 404 shim param', () => {
    // The site's 404.html redirects /docs/<app>/<rest> to
    // <app>/?__smvc_path=<rest>; the Router consumes it on construction.
    history.pushState(null, '', '/?__smvc_path=user%2F5%3Fx%3D1');
    const r = new Router(routes, '/');
    expect(location.pathname).toBe('/user/5');
    expect(r.url.value).toBe('/user/5?x=1');
    history.pushState(null, '', '/');
  });
});

describe('RouterOutlet edge cases', () => {
  it('nested outlet without OutletChildren context renders null', async () => {
    const { OutletDepth } = await import('./outlet');
    render(() => (
      <OutletDepth.Provider value={1}>
        <RouterOutlet />
      </OutletDepth.Provider>
    ));
    // No OutletChildren provider above depth-1: child?.() ?? null.
    expect(document.body.textContent).not.toContain('user');
  });
});

describe('attachRouter', () => {
  it('maps wire matches without ROUTE_INFO_KEY to a route stub', async () => {
    const r = makeRouter();
    // Wire matches from a @solidjs/router tree that didn't come through
    // toRouteDef carry no info stamp — the fallback keeps originalPath.
    createRoot((dispose) => {
      r.attachRouter(
        () => {},
        { pathname: '/x', search: '' } as RouterLocation,
        () => [{ route: { originalPath: '/x' } as any, params: { id: '5' }, path: '/x' }],
      );
      return dispose;
    });
    await settle();
    expect(r.matches.value?.[0].route.path).toBe('/x');
    expect(r.matches.value?.[0].params).toEqual({ id: '5' });
  });

  it('keeps the raw param when percent-decoding throws', async () => {
    const r = makeRouter();
    // Lone trailing % is not a valid escape — decodeURIComponent throws
    // and decodeParams falls back to the raw segment.
    createRoot((dispose) => {
      r.attachRouter(
        () => {},
        { pathname: '/x', search: '' } as RouterLocation,
        () => [{ route: { originalPath: '/x' } as any, params: { id: 'a%' }, path: '/x' }],
      );
      return dispose;
    });
    await settle();
    expect(r.matches.value?.[0].params.id).toBe('a%');
  });
});

describe('Link', () => {
  it('navigates without a page reload on click', async () => {
    const M = RouterModule.forRoot(routes, { basePath: '/' });
    const root = new Injector();
    const inj = createModuleInjector(M, root);
    const router = inj.get(Router);
    router.url.value = '/';
    render(() => (
      <InjectorContext.Provider value={inj}>
        <div>
          <Link to="/user/1">go</Link>
          <RouterOutlet />
        </div>
      </InjectorContext.Provider>
    ));
    fireEvent.click(screen.getByText('go'));
    await settle();
    expect(router.url.value).toBe('/user/1');
    expect(location.pathname).toBe('/user/1');
    expect(await screen.findByText('user')).toBeTruthy();
  });

  it('ignores modified/non-primary clicks and honors onClick preventDefault', async () => {
    const M = RouterModule.forRoot(routes, { basePath: '/' });
    const root = new Injector();
    const inj = createModuleInjector(M, root);
    const router = inj.get(Router);
    router.url.value = '/';
    render(() => (
      <InjectorContext.Provider value={inj}>
        <Link to="/user/1" onClick={(e) => e.preventDefault()}>guarded</Link>
        <Link to="/user/2">plain</Link>
      </InjectorContext.Provider>
    ));
    // onClick that prevents default → no navigation.
    fireEvent.click(screen.getByText('guarded'));
    await settle();
    expect(router.url.value).not.toBe('/user/1');
    // Modified click → browser handles it, router stays put.
    fireEvent.click(screen.getByText('plain'), { ctrlKey: true });
    await settle();
    expect(router.url.value).not.toBe('/user/2');
  });
});
