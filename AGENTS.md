# AGENTS.md — SolidMVC

A greenfield frontend framework: Angular-inspired modules/DI/decorators +
MVC organization + class-based JSX views rendered by Solid + signal
reactivity (`@solid-mvc/core`), plus Atoll-modeled worker islands
(`@solid-mvc/atoll` core + the `@solid-mvc/atoll-island` adapter) that
render views inside Web Workers. Layout mirrors Atoll's
`islands`/`react`/`react-island` split (docs/atoll/islands-frameworks.md).

## `docs/` is your second memory

**Read `docs/` before doing extensive work here, and write to it when you
learn something durable.** The folder is the project's externalized memory:

- `docs/atoll/` — a vendored copy of the Atoll worker-framework docs
  (the architecture `packages/atoll/` is modeled on). Treat it as read-only
  source material: it describes *their* implementation, not ours. When
  working on `packages/atoll*/`, the relevant pages are `islands.md`,
  `islands-worker.md`, and `islands-frameworks.md` — read them before
  changing the op protocol, proxy DOM, instance lifecycle, or adapter API.
- `docs/framework.md` — our own architecture map (DI, modules, views,
  router, lifecycle). Update it when the framework's semantics change.
- `docs/islands.md` — our islands package: the subset of the Atoll design
  we implemented, and deliberate divergences. Update it in the same change
  as the code it describes.
- `docs/docs-site.md` — the consumer docs site (`docs-consumer/`), the
  Pages landing page (`pages-landing/`), and the `dist-pages/` deploy
  pipeline. Update it when the site structure or deploy tree changes.

If a behavior exists but isn't documented, add it to the right `docs/` page
as part of your change. If docs and code disagree, trust the code and fix
the doc.

## Commands

```bash
npm install              # deps (+ links the @solid-mvc/* workspaces)
npm test                 # vitest — all suites (framework + app + islands)
npm run test:watch
npm run typecheck        # tsc --noEmit over src + packages
npm run typecheck:all    # root + each package's own dep graph + enterprise
npm run build            # vite build (emits the worker chunk)
npm run dev              # dev server on :5173
npm run dev:enterprise   # examples/enterprise dev server
npm run dev:docs         # docs-consumer dev server on :4190
npm run build:docs       # docs-consumer: client + SSR + prerender → dist/
npm run build:pages      # build docs + demos, assemble dist-pages/
npm run serve:pages      # build + serve the Pages artifact on :4190
npm run ci               # typecheck:all + test — what CI runs
npm run ci:install       # npm ci root + examples (CI/publish install)
npm run publish:dry      # publish.mjs dry run — tarballs + stage order
npm run publish -- <ver> # lockstep staged publish (see below)
```

## CI & publish

`.github/workflows/ci.yml` — checks (typechecks + build), test, audit.
`.github/workflows/publish.yml` — on GitHub Release: test gate, then
`scripts/publish.mjs <tag>` stamps all packages to the release version
(repo files keep `0.0.0`), rewrites internal `@solid-mvc/*` ranges, and
`npm stage publish`es in dep order (core → atoll → atoll-island → cli) with
OIDC provenance. Repo exports stay `./src` for dev (workspace links
resolve them); publish.mjs compiles `dist/` (tsc emit: `.js` + `.d.ts`)
before staging and rewrites `exports`/`files`/`types` to `dist` — the
published tarballs ship compiled JS, so consumers never transform
framework sources. Packages carry `tsconfig.build.json` + a `build`
script; `npm run build:packages` compiles all three. First
release needs a one-time bootstrap: `npm run publish -- <ver> --direct`.

## Repo shape

```
packages/core/        @solid-mvc/core — the framework: injector,
                      decorators, modules, View classes, signals,
                      context, router
packages/atoll/       @solid-mvc/atoll — facade over @atolljs/islands +
                      @atolljs/core (the op protocol, proxy DOM, worker
                      runtime, and driver are AtollJS code). `.` entry =
                      shell/mount API, `./worker` = worker defs
packages/atoll-island/ @solid-mvc/atoll-island — the *-island adapter:
                      `.` entry = <Island/>/islandComponent/lazyIsland
                      shell surface, `./worker` = viewIslandApp/
                      defineViewPolyWorker renderer
packages/cli/         @solid-mvc/cli — `smvc` bin: new / generate /
                      serve / build / test / add / update. Dependency-free
                      .mjs (ships runnable JS — a bin can't be .ts).
src/app/              demo app — todos/counter/hello/standalone/islands
src/ui/ src/lib/      shared design system: Tailwind v4 + shadcn tokens,
                      cn() + CVA components (same skin as enterprise)
src/test-setup.ts     vitest jsdom setup (Storage + matchMedia stubs)
examples/enterprise/  separate vite app consuming the packages by name
docs-consumer/        consumer docs site (Vite app — prerenders one static
                      page per route; deployed to GitHub Pages)
pages-landing/        the site-root landing page (static, no build)
dist-pages/           assembled Pages artifact (build output, never edit)
docs/                 second memory — see above
```

## Non-negotiable rules

- **Views are classes, not hooks.** `View` subclasses are constructed once
  inside their own injector scope by the `createComponent` seam in
  `packages/core/src/view.ts` + `web.ts` — never let Solid instantiate
  them directly. `inject()` belongs in field initializers/constructors;
  `render()` runs once — signal reads must sit inside JSX expressions.
  **One solid-js realm**: every vite config aliases `solid-js`/`solid-js/web`
  to the client build (the node/worker export conditions pick the dead
  server build), and vitest inlines Solid-importing deps.
- **The worker thread is DOM-free.** Atoll's proxy DOM
  (`@atolljs/islands/worker`, re-exported via `@solid-mvc/atoll/worker`)
  is the only "DOM" a worker sees; every mutation must serialize to an op.
  `document` in worker code resolves through the instance dispatcher —
  never assume ambient globals.
- **The wire is `postMessage`/`structuredClone`.** Props, event payloads,
  and emit payloads must be cloneable; functions cross only via
  `callbackProp` markers.
- **Worker entries must stay bundler-detectable**:
  `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`
  inline — never hoist or compute the URL.
- **Explicit registrations beat transient resolution.** A controller
  declared in `@Component({ controllers })` or `@Module({ controllers })`
  is shared down the injector chain; an undeclared `@Controller` is
  transient per injecting scope.
- Run `npx tsc --noEmit` and `npm test` before considering work done.
