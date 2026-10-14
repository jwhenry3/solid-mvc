import { describe, it, expect, vi } from 'vitest';
import {
  Injector,
  InjectionToken,
  inject,
  runInInjectionContext,
  DestroyRef,
} from './injector';
import { Injectable, Controller } from './decorators';

class Service {
  value = 1;
}

describe('Injector', () => {
  it('resolves a class provider as a singleton per injector', () => {
    const inj = new Injector();
    inj.provide(Service);
    expect(inj.get(Service)).toBeInstanceOf(Service);
    expect(inj.get(Service)).toBe(inj.get(Service));
  });

  it('supports useValue, useClass, and useFactory with deps', () => {
    const URL = new InjectionToken<string>('url');
    const PREFIX = new InjectionToken<string>('prefix');
    const inj = new Injector();
    inj.provide({ provide: URL, useValue: '/api' });

    const SVC = new InjectionToken<Impl>('svc');
    class Impl {
      url = inject(URL);
    }
    inj.provide({ provide: SVC, useClass: Impl });
    inj.provide({ provide: PREFIX, useFactory: (u: string) => `${u}/v1`, deps: [URL] });

    expect(inj.get(SVC).url).toBe('/api');
    expect(inj.get(PREFIX)).toBe('/api/v1');
  });

  it('delegates resolution to the parent injector', () => {
    const parent = new Injector();
    parent.provide(Service);
    const child = new Injector(parent);
    expect(child.get(Service)).toBe(parent.get(Service));
  });

  it('local providers shadow parent providers', () => {
    const parent = new Injector();
    parent.provide(Service);
    const child = new Injector(parent);
    const fake = new Service();
    child.provide({ provide: Service, useValue: fake });
    expect(child.get(Service)).toBe(fake);
    expect(parent.get(Service)).not.toBe(fake);
  });

  it('throws a named error for missing providers', () => {
    const inj = new Injector(null, 'test scope');
    expect(() => inj.get(Service)).toThrow('No provider for Service');
    expect(() => inj.get(Service)).toThrow('test scope');
  });

  it('inject() resolves inside a construction context and throws outside', () => {
    class Dep {
      svc = inject(Service);
    }
    expect(() => inject(Service)).toThrow(/outside an injection context/);
    const inj = new Injector();
    inj.provide(Service);
    expect(inj.instantiate(Dep).svc).toBeInstanceOf(Service);
  });

  it('runInInjectionContext makes inject() work for plain functions', () => {
    const inj = new Injector();
    inj.provide(Service);
    const result = runInInjectionContext(inj, () => inject(Service));
    expect(result).toBeInstanceOf(Service);
  });

  it('detects circular dependencies', () => {
    const A = new InjectionToken<any>('a');
    const B = new InjectionToken<any>('b');
    class AImpl {
      b = inject(B);
    }
    class BImpl {
      a = inject(A);
    }
    const inj = new Injector();
    inj.provide({ provide: A, useClass: AImpl });
    inj.provide({ provide: B, useClass: BImpl });
    expect(() => inj.get(A)).toThrow(/Circular dependency/);
  });

  it('providedIn: root lazily registers at the root and shares the instance', () => {
    @Injectable({ providedIn: 'root' })
    class RootSvc {}
    const root = new Injector();
    const child = new Injector(root);
    const grandchild = new Injector(child);
    expect(grandchild.get(RootSvc)).toBe(root.get(RootSvc));
  });

  it('a local provider shadows a providedIn: root service', () => {
    @Injectable({ providedIn: 'root' })
    class RootSvc {}
    const root = new Injector();
    const child = new Injector(root);
    const fake = new RootSvc();
    child.provide({ provide: RootSvc, useValue: fake });
    expect(child.get(RootSvc)).toBe(fake);
    expect(root.get(RootSvc)).not.toBe(fake);
  });

  it('controllers are transient: one instance per requesting injector', () => {
    @Controller()
    class Ctrl {}
    const a = new Injector();
    const b = new Injector();
    expect(a.get(Ctrl)).toBeInstanceOf(Ctrl);
    expect(a.get(Ctrl)).toBe(a.get(Ctrl)); // same scope -> same instance
    expect(b.get(Ctrl)).not.toBe(a.get(Ctrl)); // new scope -> new instance
  });

  it('explicit controller registration beats per-scope transient', () => {
    @Controller()
    class Ctrl {}
    const parent = new Injector();
    parent.provide(Ctrl);
    const child = new Injector(parent);
    // registered at parent scope -> descendants share that instance
    expect(child.get(Ctrl)).toBe(parent.get(Ctrl));
  });

  it('controllers can inject services through the scope chain', () => {
    @Controller()
    class Ctrl {
      svc = inject(Service);
    }
    const inj = new Injector();
    inj.provide(Service);
    expect(inj.get(Ctrl).svc).toBe(inj.get(Service));
  });

  it('has() reports provider availability through the chain', () => {
    const parent = new Injector();
    parent.provide(Service);
    const child = new Injector(parent);
    expect(child.has(Service)).toBe(true);
    expect(child.has(InjectionToken)).toBe(false);
  });

  it('has() treats controller tokens as always resolvable (transient)', () => {
    class Ctrl {
      static __controller = true;
    }
    expect(new Injector().has(Ctrl)).toBe(true);
  });
});

describe('scope lifecycle', () => {
  it('activate/deactivate fire onInit/onDestroy on everything the scope built', () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    class Viewish {
      onInit = onInit;
      onDestroy = onDestroy;
    }
    const inj = new Injector();
    inj.instantiate(Viewish);
    inj.activate();
    expect(onInit).toHaveBeenCalledTimes(1);
    inj.deactivate();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('does not manage classes without lifecycle methods', () => {
    const inj = new Injector();
    inj.instantiate(Service);
    expect(() => {
      inj.activate();
      inj.deactivate();
    }).not.toThrow();
  });

  it('instances created after activation get onInit immediately', () => {
    const onInit = vi.fn();
    class Late {
      onInit = onInit;
    }
    const inj = new Injector();
    inj.activate();
    inj.instantiate(Late);
    expect(onInit).toHaveBeenCalledTimes(1);
  });

  it('DestroyRef registers cleanup that runs on deactivate', () => {
    class S {
      ref = inject(DestroyRef);
    }
    const inj = new Injector();
    inj.provide(S);
    const cleanup = vi.fn();
    inj.get(S).ref.onDestroy(cleanup);
    inj.deactivate();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
