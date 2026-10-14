# Enterprise example

A self-contained Vite app showing how to build an enterprise-grade application
on `@solid-mvc/core` + `@solid-mvc/atoll-island`: Tailwind CSS v4, a
shadcn-style component layer, TanStack Query, zod, ECharts, lucide icons, and a
worker-rendered island, all wired through the framework's DI/module/view
architecture rather than React-style hooks.

```bash
npm install
npm run dev        # http://localhost:5175
npm run build
npm run typecheck
```

## What it demonstrates

| Concern | Approach | Where |
|---|---|---|
| Styling | Tailwind v4 via `@tailwindcss/vite`, shadcn token theme (HSL CSS vars, light/dark) | `src/styles.css` |
| UI primitives | shadcn-flavored components built on `cn()` (`clsx` + `tailwind-merge`) and CVA variants | `src/ui/` |
| Theme | `ThemeService`: injectable signal-backed service, persisted, system-aware | `src/services/theme.service.ts` |
| Server state | `@tanstack/query-core` `QueryClient` provided through framework DI (`QueryModule`), consumed via a signal-backed `querySignal` helper | `src/lib/query.module.ts`, `src/lib/query.ts` |
| Data layer | `FakeApi` injectable service simulating latency/entities | `src/services/fake-api.service.ts` |
| Forms | Declared `@Controller` owns field signals; zod schema validates on submit | `src/pages/settings.view.tsx` |
| Charts | ECharts SVG renderer running on a dedicated chart worker, replayed into the dashboard | `src/islands/revenue-chart.island.tsx`, `src/workers/chart.worker.tsx` |
| Worker UI | Chart + ticker islands on dedicated workers (`islandComponent` + contracts); users/settings/components pages render inside per-page workers via `PageWorkerHost` + `WorkerPage` | `src/workers/`, `src/pages/worker-page.tsx` |
| Routing | `RouterModule` + module-scoped route injectors | `src/app/routes.ts` |
| Icons / dates | `lucide-solid`, `date-fns` | throughout |

## Architecture notes

The app consumes the framework exactly like an external user would: everything
imports from the published package names (`@solid-mvc/core`,
`@solid-mvc/atoll-island`, `@solid-mvc/atoll-island/worker`), resolved here
through `file:` workspace deps.

Key patterns to copy:

- **Library integration via DI, not context.** `QueryModule` registers the
  `QueryClient`; views `inject(QUERY_CLIENT)`. Any library with a client
  object wires the same way.
- **`querySignal(query)`** bridges TanStack's `QueryObserver` into a signal,
  so views get fine-grained reactivity and automatic disposal through the
  view's `DestroyRef`. This is the template for wrapping any
  subscribe/unsubscribe library.
- **Controllers own interaction state.** The settings form, the users-page
  debounced search, and the theme are all controller/service state; views
  only bind and render.
- **Islands for offload.** The dashboard is a main-thread page that mounts
  two dedicated worker islands — `chartContract` (echarts' SVG ops built on
  the chart thread) and `tickerContract` (a live render loop) — via
  `islandComponent(contract)`. The users/settings/components routes go
  further: the whole page renders inside its own worker (`WorkerPage` +
  `PageWorkerHost`), and `data-atoll-slot` is gone — island mounts are
  plain components again.
- **Contracts carry the worker.** `src/islands/*.contract.ts` pairs the
  registry name, zod wire schemas, and the bundler-detectable
  `new Worker(new URL(...))` factory — the view just renders `<Chart/>`.
- **One cache, many threads.** `lib/broadcast-query.ts` syncs each
  QueryClient over BroadcastChannel, so the shell's skeleton gate sees the
  worker's fetched data without a second fetch crossing the wire.

## Layout

```
src/
  styles.css              Tailwind v4 + shadcn tokens (light/dark)
  lib/cn.ts               clsx + tailwind-merge
  lib/query.ts            QueryObserver -> signal bridge
  lib/query.module.ts     QueryClient as a framework module provider
  lib/broadcast-query.ts  QueryClient cache sync over BroadcastChannel
  services/               ThemeService, FakeApi, PageWorkerHost
  islands/                worker island apps + contracts (chart, ticker)
  ui/                     shadcn-style primitives (button, card, table,
                          dialog, tabs, input, badge, misc)
  workers/                worker entries: chart, ticker, users, settings,
                          components (+ shared worker-side providers)
  app/                    AppModule, routes, shell (sidebar/header/nav)
  pages/                  dashboard (main thread), users, settings,
                          components, worker-page host
  main.tsx                bootstrap + installViewInterop
```
