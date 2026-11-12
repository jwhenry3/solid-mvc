import { describe, it, expect, vi } from 'vitest';
import { Injector, inject } from './injector';
import { Injectable, Module, ownerOf } from './decorators';
import {
  bootstrap,
  createModuleInjector,
  getModuleInjector,
  getModuleMeta,
  registerModule,
} from './module';
import { View } from './view';

class Shared {}
class ServiceA {}
class ServiceB {}

@Module({ providers: [Shared] })
class SharedMod {}

@Module({ imports: [SharedMod], providers: [ServiceA] })
class FeatureMod {}

// Diamond: both FeatureMod and OtherMod import SharedMod; RootMod imports both.
@Module({ imports: [SharedMod], providers: [ServiceB] })
class OtherMod {}

@Module({ imports: [FeatureMod, OtherMod] })
class RootMod {}

class DeclaredView extends View {
  render() {
    return null;
  }
}

@Module({ components: [DeclaredView] })
class DeclaringMod {}

describe('module injectors', () => {
  it('registers the module’s own providers', () => {
    const root = new Injector();
    const inj = createModuleInjector(FeatureMod, root);
    expect(inj.get(ServiceA)).toBeInstanceOf(ServiceA);
  });

  it('imports contribute providers transitively', () => {
    const root = new Injector();
    const inj = createModuleInjector(RootMod, root);
    expect(inj.get(ServiceA)).toBeInstanceOf(ServiceA);
    expect(inj.get(ServiceB)).toBeInstanceOf(ServiceB);
    expect(inj.get(Shared)).toBeInstanceOf(Shared);
  });

  it('dedupes diamond imports into one shared instance', () => {
    const root = new Injector();
    const inj = createModuleInjector(RootMod, root);
    expect(inj.get(Shared)).toBe(inj.get(Shared));
  });

  it('records the transitive module closure on the injector', () => {
    const root = new Injector();
    const inj = createModuleInjector(RootMod, root);
    expect([...inj.modules]).toEqual(
      expect.arrayContaining([RootMod, FeatureMod, OtherMod, SharedMod])
    );
  });

  it('getModuleInjector caches per parent injector', () => {
    const root = new Injector();
    const a = getModuleInjector(FeatureMod, root);
    expect(getModuleInjector(FeatureMod, root)).toBe(a);
    const other = new Injector();
    expect(getModuleInjector(FeatureMod, other)).not.toBe(a);
  });

  it('throws when given something without module metadata', () => {
    expect(() => createModuleInjector(class {}, new Injector())).toThrow(/not a module/);
  });

  it('throws when an imported member lacks module metadata', () => {
    @Module({ imports: [class Plain {}] })
    class Bad {}
    expect(() => createModuleInjector(Bad, new Injector())).toThrow(/not a module/);
  });

  it('bootstrap throws when the root module declares no bootstrap component', () => {
    @Module({ providers: [] })
    class NoBoot {}
    expect(() => bootstrap(NoBoot, document.createElement('div'))).toThrow(
      /must declare a bootstrap component/,
    );
  });

  it('exposes module metadata', () => {
    expect(getModuleMeta(FeatureMod)?.providers).toContain(ServiceA);
  });
});

describe('bootstrap module scope', () => {
  it('lets a providedIn: root service inject forRoot-style module providers', () => {
    class FeatureSvc {}
    // A forRoot-style bundle: module metadata on a plain object, the same
    // shape RouterModule.forRoot() returns.
    const forRoot = { __module: { providers: [FeatureSvc] } };
    @Injectable({ providedIn: 'root' })
    class RootSvc {
      feature = inject(FeatureSvc);
    }
    @Module({ imports: [forRoot] })
    class AppModule {}
    // bootstrap() registers the root module into the root injector itself.
    const root = new Injector(null, 'root');
    registerModule(AppModule, root, new Set());
    expect(root.get(RootSvc).feature).toBeInstanceOf(FeatureSvc);
  });

  it('resolves the same graph through bootstrap()', () => {
    class FeatureSvc {
      label = 'from module';
    }
    const forRoot = { __module: { providers: [FeatureSvc] } };
    @Injectable({ providedIn: 'root' })
    class RootSvc {
      feature = inject(FeatureSvc);
    }
    class AppView extends View {
      svc = inject(RootSvc);
      render() {
        return this.svc.feature.label;
      }
    }
    @Module({ imports: [forRoot], bootstrap: [AppView] })
    class AppModule {}
    const host = document.createElement('div');
    document.body.appendChild(host);
    const dispose = bootstrap(AppModule, host);
    try {
      expect(host.textContent).toBe('from module');
    } finally {
      dispose();
      host.remove();
    }
  });
});

describe('module-declared controllers', () => {
  it('register at module scope — shared across descendant scopes', () => {
    class C {}
    (C as any).__controller = true;
    @Module({ controllers: [C] })
    class M {}
    const modInj = createModuleInjector(M, new Injector());
    const child = new Injector(modInj);
    expect(child.get(C)).toBe(modInj.get(C));
    const otherChild = new Injector(modInj);
    expect(otherChild.get(C)).toBe(modInj.get(C)); // one shared instance
  });
});

describe('component ownership', () => {
  it('maps declared views to their declaring module', () => {
    expect(ownerOf(DeclaredView)).toBe(DeclaringMod);
  });

  it('leaves undeclared views unowned', () => {
    class Free extends View {
      render() {
        return null;
      }
    }
    expect(ownerOf(Free)).toBeUndefined();
  });

  it('warns and keeps the first owner when two modules declare one view', () => {
    class SharedView extends View {
      render() {
        return null;
      }
    }
    @Module({ components: [SharedView] })
    class FirstMod {}
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      @Module({ components: [SharedView] })
      class SecondMod {}
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('declared by both'),
      );
      expect(ownerOf(SharedView)).toBe(FirstMod);
    } finally {
      warn.mockRestore();
    }
  });
});
