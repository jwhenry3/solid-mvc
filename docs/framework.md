# Framework architecture

Angular-inspired modules/DI/decorators + MVC organization + class-based JSX
views rendered by Solid + signal reactivity. Source: `packages/core/src/`
(published in-repo as `@solid-mvc/core`).

## The stack in one paragraph

`View` classes are the components. They are real JSX imports (identity comes
from the import binding, not a registry). JSX compiles against the
`@solid-mvc/core/web` runtime module (babel-preset-solid `moduleName`), whose
`createComponent` routes every View subclass through `viewComponent()`: a
host component that constructs the class inside a fresh child injector at
mount. Models are injectable services (`@Injectable`); controllers are
injectable view logic (`@Controller`); views render JSX whose expressions
track signal reads. `@Module` composes providers and declares component
ownership; `@Component({ providers, controllers, imports })` gives a view
its own scope and can make it standalone.

## The JSX-runtime seam (`web.ts`)

Solid has no `options.vnode` interception. The equivalent seam is the
JSX runtime module: vite-plugin-solid emits `createComponent(Comp, props)`
calls imported from whatever `moduleName` names, so `web.ts` re-exports
`solid-js/web` wholesale and overrides only `createComponent`. View classes
become `viewComponent(cls)` host components; everything else passes through
to Solid untouched. The main thread compiles with
`moduleName: '@solid-mvc/core/web'`; worker/island files compile
`generate: 'universal'` against `@solid-mvc/atoll-island/worker`, which
provides the same interception over the universal renderer's runtime
surface (see `islands.md`).

One realm rule: the `node`/`worker` export conditions on `solid-js`
resolve to the server build, where effects never re-run. Every vite
config (root, enterprise, generated) aliases `solid-js` +
`solid-js/web` to the client build, and vitest inlines every
Solid-importing dependency so no second realm exists.

## Dependency injection (`injector.ts`)

- `Injector(parent?, name?)` — hierarchical. `provide(provider)` registers
  class / `useValue` / `useClass` / `useFactory({ deps })` providers.
- `inject(token)` — resolves inside an injection context (construction via
  `instantiate`, or `runInInjectionContext`). Walks ancestor injectors.
- Provider-vs-transient: registered providers memoize per registering scope;
  `@Controller` classes injected *without* a registration are transient —
  one fresh instance per injecting scope.
- `inject()` searches the **whole ancestor chain for an explicit
  registration first**; only when none exists does the current scope
  auto-instantiate the controller. This is what makes declaration scope
  meaningful (see the controller-scope matrix below).
- `InjectionToken('desc', { factory })`, `providedIn: 'root'` on
  `@Injectable` — both resolve against the root injector.
- `DestroyRef` — every injector pre-registers itself; `inject(DestroyRef)`
  gives classes a handle to `onDestroy(fn)` registrations run at
  `deactivate()`. Injector deactivation also disposes the scope's Solid
  owner, so `onCleanup`/`onDestroy` registrations behave like Angular's.

## Signals (`signals.ts`)

Solid primitives underneath, keeping the `.value` surface the framework was
written against: `signal()` returns a getter/setter-backed object with
`.value`; `computed`, `batch`, `untracked` wrap `createMemo`/`batch`/
`untrack`. One addition: **`effect()` is scope-bound**. Created inside a
constructor or field initializer (i.e. inside `instantiate`), it registers
its disposer on the current injector's `DestroyRef` and dies at
`deactivate()`. Outside an injection context it runs under the caller's
Solid owner and must be disposed manually. Field-initializer effects work
because field initializers run inside the injection context — declare them
*below* the signals they read (effects run once immediately at
construction).

## Views (`view.ts`)

- `class X extends View<P>` — `render()` returns JSX. `this.props` is a
  getter-backed object assigned before construction completes: field
  initializers read initial values and JSX reads stay live (each prop key
  is a Solid accessor).
- Mount path: `createComponent` sees a `View` subclass → `viewComponent`
  swaps in a host → at mount the host creates `new Injector(parent,
  'view X')`, registers `@Component({ imports/providers/controllers })`
  into it, instantiates the view inside it, and renders through a
  `InjectorContext.Provider`.
- `render()` runs **once** (Solid's model, not a diff pass). Reactivity is
  where the compiler wraps expressions: signal reads inside JSX child
  expressions, attributes, and `<For>`/`<Show>` update exactly the DOM
  that read them. An eager read in the render body is a snapshot.
- `JSX.ElementAttributesProperty` is augmented so JSX attributes on
  `View<P>` classes derive from the instance `props` member — `<V a={1}/>`
  typechecks against `P`.
- Lifecycle: `onInit`/`onDestroy` on views and injected controllers run on
  injector activate/deactivate; deactivate disposes the Solid owner, so
  cleanups pair correctly even on same-tick mount+unmount.
- `setState`/`forceUpdate` on a View throw intentionally; refs on views
  throw. State lives in signals.
- **Error boundary**: each host wraps the view in Solid `ErrorBoundary` —
  mount/render failures render a fallback box (with Retry) instead of
  taking down the whole tree.
- Function components are untouched by all of this — they get real Solid
  semantics (`onMount`, `createMemo`, `useContext` legal at setup). Solid
  "hooks" inside `View.render()` are forbidden by convention: render is a
  plain method, not a component closure.

## Modules (`module.ts`) and decorators (`decorators.ts`)

- `@Module({ providers, imports, controllers, components, bootstrap })`.
- `createModuleInjector(cls, parent)` — caches one injector per
  (module class, parent injector) pair; `imports` are registered into it
  recursively. `injector.modules` is the transitive closure of the module
  and its imports.
- **Ownership**: `components`/`bootstrap` declarations register
  view-class → module. Mounting a declared view whose owner is not in the
  ancestor chain's `modules` closure throws a clear error at mount (the
  boundary catches it locally). Undeclared views mount freely — the import
  binding is their identity.
- `@Component({ providers, controllers, imports })` — `imports` makes a
  view standalone (Angular's `standalone` + `imports` pattern): the module's
  providers and component visibility enter the view's own scope.
- `bootstrap(ModuleCls, el)` renders the module's bootstrap component via
  Solid `render()` inside the root injector's context.

Controller scope matrix:

| Where declared | Lifetime |
|---|---|
| nowhere (`inject(Ctrl)`) | transient, one per injecting scope |
| `@Component({ controllers })` | shared with that view's subtree |
| `@Module({ controllers })` | shared across the module's scope |
| `@Component({ imports: [M] })` | M's providers enter the view's scope |

`useController(C)` (controller.ts) is the explicit escape hatch: always a
fresh instance owned by the calling function component's mount.

## Router (`router/`)

Routing is backed by `@solidjs/router` — the framework keeps its own
service surface (`Router`, `RouterModule.forRoot`, `RouterOutlet`,
`Link`) as an adapter over it. `Router` holds the URL and the matched
chain as signals; `RouterModule.forRoot(routes)` returns a module-shaped
provider bundle. Route entries may carry `component`, `module`, and
`children`; module routes create the module injector under that outlet
level. `:param` segments decode into merged `params`; `*` is a wildcard.
`Link` calls `navigate()` on click.

**The bridge.** The root `<RouterOutlet/>` mounts the actual
`@solidjs/router` `<Router>` tree: the route table maps to
`RouteDefinition[]` (each route rides on `info.smvcRoute` so wire matches
map back), each `RouteDefinition.component` is a frame that swaps in the
route module's injector and hands the router's child element to nested
outlets. A `RouterBridge` component under the tree captures
`useNavigate`/`useLocation`/`useCurrentMatches` and feeds them to the
`Router` service, so `url`/`matches`/`params` track the live router and
`navigate()` delegates to its navigator. Until a tree mounts (standalone
`new Router(routes, base)`, views outside an outlet, worker realms) the
service falls back to its own matcher with the same semantics.

**Navigation ownership.** `navigate()` delegates to the mounted
navigator, which settles on @solidjs/router's transition lane — `url`,
`history`, and outlet content land asynchronously (a `setTimeout` tick in
tests). `popstate` is tracked both by the service (standalone) and by the
router tree. A document-level interceptor inside @solidjs/router claims
same-origin `<a href="/…">` clicks, skipping clicks that were already
`preventDefault`ed — which is exactly what `Link` does, so the two never
double-navigate. Foreign anchors (markup that bypassed `<Link>`) get
in-app navigation for free.

**Nested routes.** The URL resolves against `children` as a chain
outermost → innermost (`router.matches` — bridged from
`useCurrentMatches` while mounted, service-matched otherwise), each
`<RouterOutlet/>` rendering its depth via context — a parent shell stays
mounted while the child swaps. A route with children matches by prefix;
a leaf must consume the whole tail. Params merge across levels (inner
wins). Module routes nest injectors the same way: the child's module
injector parents under the level that mounted it.

**Base path.** The router knows its mount prefix so the same bundle runs at
site root or nested under a static tree (the Pages demos mount under
`docs/demo/`). Resolution order: `RouterModule.forRoot(routes, { basePath })`
wins; otherwise the Router derives the base from `document.baseURI`'s
directory at construction (the Vite demo ships no `<base>` tag, so baseURI
is simply its URL). The base is handed to `<Router base>`: only URLs under
the prefix match at all (stricter than the old matcher, which matched
anyway). `url` exposes the path with the base stripped; `navigate` and
`Link` hrefs prepend it. An app on `/docs/demo/` sees `/todos` and emits
`/docs/demo/todos`. Deep-linking still needs the host to serve
`index.html` for the path; GitHub Pages uses `404.html` or a redirect
shim (`__smvc_path`, consumed in the Router constructor).

**Worker realms.** `@solidjs/router` evaluates cleanly at module scope
but its `<Router>` reads `window.location`/`history` when instantiated —
worker islands never mount a root outlet, so the import is inert there.
The service itself is realm-safe: all DOM globals are `typeof`-guarded.

## Invariants not to break

- Construction is the only injection context; `inject()` elsewhere throws.
- Lifecycle pairs on scope activate/deactivate, never on render alone.
- Declared components enforce scope; undeclared ones stay free.
- `render()` runs once; signal reads must live inside JSX accessors to
  stay tracked.
- Exactly one `solid-js` realm per graph: the client build, never the
  node/worker-condition server build.
- Ops and wire shapes in `packages/atoll/` are documented in `islands.md`.
