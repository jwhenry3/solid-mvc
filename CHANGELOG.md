# Changelog

All notable changes to `@solid-mvc/core`, `@solid-mvc/atoll`,
`@solid-mvc/atoll-island`, and `@solid-mvc/cli` are documented here.
The packages release in
lockstep under a single version stamped from the GitHub release tag.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.0]

Initial release.

### `@solid-mvc/core`

Angular-inspired architecture on SolidJS: modules, dependency injection,
decorators, MVC organization, class-based JSX views, and signal
reactivity.

#### Added

- **Class-based `View` components.** Views are real classes constructed
  by the component host inside a fresh child injector at mount; they are
  never instantiated by Solid directly. `this.props` is available from
  field initializers onward, `render()` returns JSX, and there is no
  `setState`/`forceUpdate` — state lives in signals and `render()` runs
  once per mount while JSX accessors re-evaluate under Solid's tracking.
  Function components keep real Solid semantics.
- **Signal reactivity.** `signal`, `computed`, `effect`, `batch`,
  `untracked` built on `solid-js`. `effect()` created inside an
  injection context is scope-bound: its disposer registers on the
  current `DestroyRef` and dies at scope teardown. Signal reads in
  `render()` auto-track and re-render the view.
- **Hierarchical dependency injection.** `Injector`, `inject()`,
  `InjectionToken`, `runInInjectionContext`. Providers support class,
  `useValue`, `useClass`, and `useFactory({ deps })` forms;
  `providedIn: 'root'` resolves against the root injector.
- **`DestroyRef` lifecycle.** Every injector registers one;
  `onDestroy(fn)` callbacks run at `deactivate()`. `OnInit`/`OnDestroy`
  on views and injected controllers pair on scope activate/deactivate,
  never on render alone.
- **Decorators.** `@Module`, `@Component`, `@Injectable`, `@Controller`.
- **MVC organization.** `@Controller` classes hold injectable view logic.
  Undeclared controllers are transient per injecting scope; controllers
  declared in `@Component({ controllers })` or `@Module({ controllers })`
  are shared down that injector chain. `useController` gives function
  components an explicitly owned instance.
- **Modules.** `@Module({ providers, imports, controllers, components,
  bootstrap })` composes providers recursively; one injector is cached
  per (module class, parent injector) pair. Declared `components`/
  `bootstrap` entries enforce ownership: mounting a declared view outside
  its owner's scope throws a clear error at mount.
- **Standalone components.** `@Component({ imports: [ModuleA] })` pulls
  the module's providers and component visibility into the view's own
  scope, Angular-style.
- **Router.** Signal-based routing over `@solidjs/router`:
  `RouterModule.forRoot(routes)`, `RouterOutlet`, `Link`. Nested routes
  resolve as an outlet chain (`:param` segments, `*` wildcard, params
  merge outer to inner). Module routes nest injectors at the outlet
  level. Base-path support lets one bundle mount at site root or under a
  static subtree. When a `@solidjs/router` tree mounts, the service
  bridges to it: `navigate` delegates to its navigator and matches flow
  from the live router context.
- **Context bridging.** `InjectorContext`, `useInjector`, `useService`,
  `Provide` expose the injector graph to ordinary Solid function
  components.
- **View error boundary.** Mount/render failures render a fallback box
  with retry instead of tearing down the tree.
- **`bootstrap(AppComponent, { routes?, module? })`** builds the root
  injector and renders the app.
- **`sideEffects: false` in every library manifest.** Enables bundler
  tree-shaking and npm's exports analysis. The only import-time effect,
  `view.ts`'s `installViewInterop()`, is retained by any real usage:
  `View` is imported to be extended, and `bootstrap` re-invokes it via
  `module.ts`.

### `@solid-mvc/atoll`

Framework-free worker-rendered islands: a facade over
`@atolljs/islands` + `@atolljs/core`, which supply the op protocol,
proxy DOM, worker runtime, and main-thread driver.

#### Added

- **`mountIsland` / `connectIslandWorker`** shell API with `WorkerLike`
  normalization (accepts `new Worker(...)`, factories, and worker-likes).
- **Message-only transport by default.** `mode: 'poll'` requires no
  COOP/COEP headers, so islands work on static hosts like GitHub Pages.
  `mode: 'push'` with the SharedArrayBuffer doorbell stays available for
  isolated deployments.
- **`callbackProp`** marks function props so they survive the
  structured-clone wire boundary.
- **Island contracts.** `defineIslandContract`, `withContract`,
  `contractOf`, `contractWorkerOf`, `islandApp`, `isIslandContract`:
  one shared module names the app, declares prop and event schemas
  (zod `z` re-exported), and carries the worker factory.
- **`keepAlive` option** on both `connectIslandWorker` and
  `mountIsland`: unmount the island instance (dispose hooks, observer
  and interval cleanup, DOM clear replay) while leaving the worker
  thread, module graph, and injector resident for warm remounts.
  `client.terminate()` still kills the thread explicitly.
- **`./worker` subpath** re-exports the worker runtime:
  `definePolyWorker` (one script, many named apps), `defineMonoWorker`
  (one script, one app), `emit`, `runInInstance`,
  `enterInstance`/`exitInstance`, and proxy-DOM types.

### `@solid-mvc/atoll-island`

The `*-island` adapter: mounts worker-hosted SolidMVC views as ordinary
elements in the shell app.

#### Added

- **Shell components.** `<Island/>` for inline mounts,
  `islandComponent(contract)` producing a typed component per contract,
  and `lazyIsland` for deferred loading. Shell props (`className`,
  `onEvent`, `slots`) split automatically from island props; `onEvent`
  payloads are typed by the contract's `events` map.
- **Worker renderer.** `viewIslandApp` / `viewIsland` render `View`
  classes inside the worker against the proxy DOM, with full DI and
  signal semantics preserved. `defineViewPolyWorker` /
  `defineViewMonoWorker` are the worker entry definers; contracts attach
  via `contract` options so mount props validate against the schema.
  The universal renderer maps SVG-only tags through
  `createElementNS` (same heuristic as Solid's `Dynamic`) so icons and
  charts land in the right namespace over the op wire.
- **Nested islands.** Worker apps can mount child islands on their own
  spawned sub-workers; child `emit()` events route back through the
  parent island to the shell.
- **Island events.** `emit(name, payload)` on the worker side reaches
  shell `onEvent` handlers, validated against the contract schema.

### `@solid-mvc/cli`

The `smvc` binary: project scaffolding and maintenance, dependency-free
Node.

#### Added

- **`smvc new <dir>`** — scaffolds a routed application (AppModule,
  AppShell, routes, views, jsdom test stubs, decorators-ready tsconfig,
  vite + vitest config). The generated vite config excludes
  `@solid-mvc/*` from `optimizeDeps` so scaffolded projects work against
  `file:`-linked checkouts, not just published releases. `--islands`
  adds a contract-first worker island; `--tailwind` wires Tailwind v4;
  `--skip-install`, `--skip-tests`, `--dry-run`, `--force`.
- **`smvc generate|g`** — `view`, `controller`, `service`, `module`, and
  `island` schematics emitting repo-conventional files (`*.view.tsx`,
  `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.contract.ts` +
  `*.worker.tsx`) with `--path`, `--skip-tests`, `--dry-run`, `--force`.
- **`smvc serve` / `build` / `test`** — pass-throughs to the project's
  vite/vitest binaries; `build` typechecks first (like `ng build`).
- **`smvc add`** — integration recipes: `tailwind` (deps + vite plugin
  patch + styles) and `islands` (atoll packages).
- **`smvc update`** — bumps `@solid-mvc/*` dep ranges to latest or
  `--to <version>`, with `--include-atoll`, `--dry-run`,
  `--skip-install`, and a migration hook point for future code mods.
- **`smvc version`** — CLI version plus the detected framework dep ranges
  of the enclosing project.

### Examples, docs, and tooling

- `examples/enterprise/` reference app: routed pages hosted in
  per-page keep-alive worker islands (lazy first-visit spawn, warm
  remounts), nested ticker and chart sub-workers, TanStack Query
  synchronization across the thread boundary, and theme props flowing
  through the island hierarchy.
- `docs-consumer/` documentation site with a static page per route,
  deployable to GitHub Pages.
- **Compiled package publishing.** Each library carries
  `tsconfig.build.json` + `npm run build` (tsc emit: `.js` + `.d.ts`);
  `publish.mjs` compiles `dist/` before stamping and rewrites
  `exports`/`files`/`types` to it, so published tarballs ship compiled
  JS and consumers never transform framework sources. Repo exports stay
  pointed at `./src` for dev — workspace links and vitest are
  unchanged. `repository` is set on every manifest so npm's sigstore
  provenance check accepts `--provenance` publishes.
- **Per-package READMEs** — CI, Codecov, and Socket badges, install,
  and verified usage snippets, rendered on each npmjs.com package page.
- **Coverage reporting** — `@vitest/coverage-v8` wired into the vitest
  config (v8 provider, `text` + `lcov`, publishable-surface include with
  threshold floors at 95/85/92/95); `npm run test:coverage` script; CI
  uploads `coverage/lcov.info` via `codecov/codecov-action`.
- **Versioned consumer docs** — Atoll-style release snapshots:
  `VITE_DOCS_VERSION` builds, `versions.json` runtime manifest, header
  version switcher preserving the current route, `noindex` on snapshots,
  `docs-v<x.y.z>.tar.gz` release assets mounted under `docs/v<x.y.z>/`.
- **Site theme** — docs-consumer and the landing page follow the
  solidjs.com palette (navy `#2c4f7c`, light blues `#4f87c7`/`#76b3e1`)
  with light-by-default + dark-preference styling.
- **Logo** — `solidmvc-*` SVG variants (icon, light/dark lockups, white
  mark) generated by `assets/build-logo.mjs` from the official Solid
  mark inside an Angular-style shield; wired into the README, landing
  page, docs header/favicon, and demo apps.
- **`pages.yml` `DOCS_BASE_URL`** — the workflow derives
  `https://<owner>.github.io/<repo>/docs/` from `github.repository` so
  deployed canonical/`og:url`/`og:image` tags never point at localhost;
  the repo variable still overrides.
- **Link-preview metadata** — full Open Graph + Twitter card tags on the
  landing page and stamped per docs route (`summary_large_image`), with
  a generated 1200x630 `social.png` share card shipped at the site root
  and inside every docs build.
- **Docs repo content** — `docs/blog/` and `docs/marketing/` entries for
  the launch article and its LinkedIn adaptation.
