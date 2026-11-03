import { render, screen, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { JSX } from 'solid-js';
import { lazyView, lazyModule } from './lazy';
import { View } from './view';
import { Injector, inject } from './injector';
import { InjectorContext } from './context';
import { Component, Module } from './decorators';
import { createModuleInjector } from './module';
import { Router, RouterModule, RouterOutlet } from './router';
import type { Route } from './router';

afterEach(() => cleanup());

// @solidjs/router settles navigations on its transition lane — url,
// history, and outlet content land a tick after navigate()/clicks.
const settle = () => new Promise((r) => setTimeout(r));

// Components evaluate where createComponent runs — a pre-made element would
// execute its body before the provider exists, so callers pass a thunk.
function mountIn(inj: Injector, child: () => JSX.Element) {
  return render(() => (
    <InjectorContext.Provider value={inj}>{child()}</InjectorContext.Provider>
  ));
}

function routedOutlet(routes: Route[], initial = '/') {
  const M = {
    __module: { imports: [RouterModule.forRoot(routes, { basePath: '/' })] },
  };
  const inj = createModuleInjector(M, new Injector());
  history.pushState(null, '', initial);
  const router = inj.get(Router);
  router.url.value = location.pathname;
  return {
    router,
    ...mountIn(inj, () => <RouterOutlet />),
  };
}

describe('lazyView', () => {
  it('defers the import until first mount, then renders', async () => {
    const load = vi.fn(() => Promise.resolve({ default: () => <p>late view</p> }));
    const Lazy = lazyView(load);
    // Facade creation is free — the chunk only fetches once mounted.
    expect(load).not.toHaveBeenCalled();
    mountIn(new Injector(), () => <Lazy />);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('late view')).toBeTruthy();
  });

  it('mounts a View class found among named exports and passes props', async () => {
    class Named extends View<{ who: string }> {
      render() {
        return <p>hi {this.props.who}</p>;
      }
    }
    const Lazy = lazyView(() => Promise.resolve({ util: 1, Named }));
    mountIn(new Injector(), () => <Lazy who="props" />);
    expect(await screen.findByText('hi props')).toBeTruthy();
  });

  it('keeps @Component imports scope for lazy standalone views', async () => {
    class Svc {
      tag = 'standalone-svc';
    }
    @Module({ providers: [Svc] })
    class SvcModule {}
    @Component({ imports: [SvcModule] })
    class Standalone extends View {
      s = inject(Svc);
      render() {
        return <p>{this.s.tag}</p>;
      }
    }
    const Lazy = lazyView(() => Promise.resolve({ default: Standalone }));
    mountIn(new Injector(), () => <Lazy />);
    expect(await screen.findByText('standalone-svc')).toBeTruthy();
  });

  it('works as a Route component', async () => {
    const Lazy = lazyView(() => Promise.resolve({ default: () => <p>routed lazy</p> }));
    routedOutlet([{ path: '/lz', component: Lazy }], '/lz');
    expect(await screen.findByText('routed lazy')).toBeTruthy();
  });

  it('renders the fallback prop while loading', async () => {
    let release!: (v: any) => void;
    const gate = new Promise<any>((r) => {
      release = r;
    });
    const Lazy = lazyView(() => gate);
    mountIn(new Injector(), () => <Lazy fallback={<p>view loading</p>} />);
    expect(await screen.findByText('view loading')).toBeTruthy();
    release({ default: () => <p>view arrived</p> });
    await settle();
    expect(await screen.findByText('view arrived')).toBeTruthy();
    expect(screen.queryByText('view loading')).toBeNull();
  });

  it('logs and renders nothing on rejection', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Lazy = lazyView(() => Promise.reject(new Error('chunk gone')));
    mountIn(new Injector(), () => <Lazy />);
    await settle();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('lazyView failed to load'),
      expect.anything(),
    );
  });
});

describe('lazyModule', () => {
  function feature() {
    class FeatureSvc {
      name = 'feature-svc';
    }
    class Boot extends View {
      s = inject(FeatureSvc);
      render() {
        return <p>{this.s.name}</p>;
      }
    }
    @Module({ providers: [FeatureSvc], bootstrap: [Boot] })
    class FeatureMod {}
    return FeatureMod;
  }

  it('mounts the module bootstrap inside its injector in JSX', async () => {
    const FeatureMod = feature();
    const LazyMod = lazyModule(() => Promise.resolve({ default: FeatureMod }));
    mountIn(new Injector(), () => <LazyMod />);
    // The bootstrap view injects a module provider — it only resolves if
    // the module injector really scoped the mount.
    expect(await screen.findByText('feature-svc')).toBeTruthy();
  });

  it('defers the import until first mount', async () => {
    const FeatureMod = feature();
    const load = vi.fn(() => Promise.resolve({ default: FeatureMod }));
    const LazyMod = lazyModule(load);
    expect(load).not.toHaveBeenCalled();
    mountIn(new Injector(), () => <LazyMod />);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('works in the Route module field with full injector scoping', async () => {
    const FeatureMod = feature();
    const LazyMod = lazyModule(() => Promise.resolve({ FeatureMod }));
    routedOutlet([{ path: '/fm', module: LazyMod }], '/fm');
    expect(await screen.findByText('feature-svc')).toBeTruthy();
  });

  it('works in the Route component field', async () => {
    const FeatureMod = feature();
    const LazyMod = lazyModule(() => Promise.resolve({ default: FeatureMod }));
    routedOutlet([{ path: '/fc', component: LazyMod }], '/fc');
    expect(await screen.findByText('feature-svc')).toBeTruthy();
  });

  it('rejects a Route[] result — modules only', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const LazyMod = lazyModule(() =>
      Promise.resolve({ default: [{ path: 'x', component: () => null }] }),
    );
    mountIn(new Injector(), () => <LazyMod />);
    await settle();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('lazyModule failed to load'),
      expect.anything(),
    );
  });
});
