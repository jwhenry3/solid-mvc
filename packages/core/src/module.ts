import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { Injector } from './injector';
import { InjectorContext } from './context';
import { viewComponent } from './view';
import type { ModuleMeta } from './decorators';

// Modules are the unit of provider scoping. A module's providers (plus those
// of its imports, transitively) register into a single child Injector. The
// injector tree mirrors the view tree: root injector -> AppModule injector ->
// feature/lazy module injectors -> per-view injectors.

export function getModuleMeta(mod: any): ModuleMeta | undefined {
  return mod?.__module;
}

// Applies a module to an injector: registers all transitively imported
// modules (and their providers/controllers) into it and marks them visible
// on injector.modules. Used for module injectors and standalone-component
// `imports` alike.
export function registerModule(mod: any, injector: Injector, seen: Set<any>): void {
  if (seen.has(mod)) return;
  seen.add(mod);
  const meta = getModuleMeta(mod);
  if (!meta) {
    throw new Error(`${mod?.name ?? mod} is not a module — missing @Module() metadata`);
  }
  for (const imp of meta.imports ?? []) registerModule(imp, injector, seen);
  injector.modules.add(mod);
  for (const provider of meta.providers ?? []) injector.provide(provider);
  // Module-declared controllers register at module scope: one shared
  // instance for everything injected under that module.
  for (const c of meta.controllers ?? []) injector.provide(c);
}

export function createModuleInjector(mod: any, parent: Injector): Injector {
  const meta = getModuleMeta(mod);
  if (!meta) {
    throw new Error(`${mod?.name ?? mod} is not a module — missing @Module() metadata`);
  }
  const injector = new Injector(parent, `module ${mod.name ?? '(anonymous)'}`);
  registerModule(mod, injector, new Set());
  return injector;
}

// Lazy/feature modules get one injector per parent injector, cached so a
// route-mounted module's providers stay alive across navigations.
const moduleInjectorCache = new WeakMap<Injector, Map<any, Injector>>();

export function getModuleInjector(mod: any, parent: Injector): Injector {
  let byModule = moduleInjectorCache.get(parent);
  if (!byModule) {
    byModule = new Map();
    moduleInjectorCache.set(parent, byModule);
  }
  let injector = byModule.get(mod);
  if (!injector) {
    injector = createModuleInjector(mod, parent);
    byModule.set(mod, injector);
  }
  return injector;
}

/**
 * Mount the root module's bootstrap component into `el`. Returns Solid's
 * dispose function — call it to unmount the app and run every scope's
 * onDestroy/cleanups.
 */
export function bootstrap(RootModule: any, el: HTMLElement): () => void {
  const root = new Injector(null, 'root');
  const appInjector = createModuleInjector(RootModule, root);
  const meta = getModuleMeta(RootModule)!;
  const App = meta.bootstrap?.[0];
  if (!App) {
    throw new Error('Root module must declare a bootstrap component: @Module({ bootstrap: [AppView] })');
  }
  return render(
    () =>
      createComponent(InjectorContext.Provider, {
        value: appInjector,
        get children() {
          return createComponent(viewComponent(App), {});
        },
      }),
    el,
  );
}
