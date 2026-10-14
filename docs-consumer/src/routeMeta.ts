/**
 * Per-route SEO metadata for the prerendered docs site.
 *
 * `prerender.mjs` writes one HTML file per route and stamps these values into
 * <title> / <meta name="description"> / canonical / Open Graph. Anything not
 * listed falls back to `metaFor`'s generic description.
 */

const ROUTE_DESC: Record<string, string> = {
  overview:
    'SolidMVC is a frontend framework combining Angular-style modules, DI, and decorators with class-based JSX views on Solid, signal reactivity, and worker-rendered islands.',
  quickstart:
    'Install SolidMVC and boot your first app: a module, a view class, a controller, and a route in ten minutes.',
  cli:
    'The smvc CLI: smvc new scaffolds an app, smvc generate scaffolds views, controllers, services, modules, and islands, with serve, build, test, add, and update.',
  di:
    'Hierarchical dependency injection: provider forms, scopes, InjectionToken, inject() in field initializers, providedIn root, and DestroyRef.',
  modules:
    '@Module composition: providers, imports, controllers, component declarations, transitive module closure, and injector scoping.',
  views:
    'View classes: @Component metadata, mount-time injection, signal-driven render(), onInit/onDestroy lifecycle, and the error boundary.',
  controllers:
    '@Controller interaction state: transient vs declared scopes, @Component controllers, useController, and controller/view separation.',
  signals:
    'Signals and effects: signal, computed, scope-bound effect with DestroyRef disposal, batch, and untracked.',
  metadata:
    '@Component metadata: providers, imports for standalone components, declared controllers, and the controller scope matrix.',
  context:
    'InjectorContext and the hooks: useInjector, useService, useController, and Provide for function components inside the tree.',
  router:
    'RouterModule and routes: path params, wildcards, Link navigation, module-scoped routes, basePath for mounted apps.',
  islands:
    'Worker-rendered islands: view classes running inside Web Workers, streamed to the DOM over an op protocol.',
  'island-apps':
    'Writing island apps: defineViewPolyWorker/defineViewMonoWorker worker entries, viewIsland apps, props, and emit() to the shell.',
  'island-shell':
    'Mounting islands from the shell: Island, islandComponent, lazyIsland, mountIsland, connectIslandWorker, and callbackProp.',
  'island-protocol':
    'How islands work: the op protocol, the proxy DOM in the worker, instance scoping, and the main-thread driver.',
  'guide-integrations':
    'The integration pattern: wrap a third-party client as an injectable, bridge subscribe APIs into signals, clean up with DestroyRef.',
  'guide-query':
    'TanStack Query via DI: QueryModule provides the QueryClient, querySignal bridges QueryObserver into a signal.',
  'guide-forms':
    'Forms the framework way: a declared controller owns field signals and zod validates on submit.',
  'guide-styling':
    'Styling and UI kits: Tailwind CSS v4, shadcn-style tokens, cn(), CVA variants, and the enterprise component layer.',
  'demo-app':
    'Live demo: the reference app — todos with a module-scoped store, counters, standalone components, and worker islands.',
  'demo-enterprise':
    'Live demo: the enterprise example — Tailwind + shadcn UI, TanStack Query, zod forms, ECharts, and a worker island.',
  hosting:
    'Deploying SolidMVC apps: static hosting, history-router fallbacks, basePath for mounted apps, and GitHub Pages notes.',
};

export interface RouteMeta {
  title: string;
  description: string;
}

export function metaFor(id: string, label: string): RouteMeta {
  // Sections may reuse 'Overview' as a nav label (the Islands section does);
  // keep titles unique by qualifying non-root overview pages.
  const titleLabel =
    label === 'Overview' && id !== 'overview'
      ? `${id[0].toUpperCase()}${id.slice(1).replace(/-/g, ' ')} overview`
      : label;
  return {
    title: `SolidMVC docs: ${titleLabel}`,
    description:
      ROUTE_DESC[id] ??
      'SolidMVC documentation: modules, DI, class-based JSX views, signals, and worker-rendered islands.',
  };
}
