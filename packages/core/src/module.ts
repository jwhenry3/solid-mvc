import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { Injector } from './injector';
import { InjectorContext } from './context';
import { viewComponent } from './view';
import type { ModuleMeta } from './decorators';

// Modules are the unit of provider scoping. A module's providers (plus those
// of its imports, transitively) register into a single Injector. The
// bootstrap module registers into the ROOT injector itself — matching
// Angular, where eager module providers share the root scope — so
// providedIn: 'root' services can inject them. Only feature/lazy modules
// get child injectors: root injector (holding the app module's graph) ->
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
  // The bootstrapped module is eager: its providers and imports merge into
  // the root injector, so providedIn: 'root' services (instantiated under
  // root) can inject them — including forRoot() bundles like
  // RouterModule.forRoot().
  registerModule(RootModule, root, new Set());
  const App = getModuleMeta(RootModule)!.bootstrap?.[0];
  if (!App) {
    throw new Error('Root module must declare a bootstrap component: @Module({ bootstrap: [AppView] })');
  }
  return render(
    () =>
      createComponent(InjectorContext.Provider, {
        value: root,
        get children() {
          return createComponent(viewComponent(App), {});
        },
      }),
    el,
  );
}
