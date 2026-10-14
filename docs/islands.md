# Islands (`packages/atoll/` + `packages/atoll-island/`)

Worker-rendered islands on the real Atoll engine
(`docs/atoll/islands.md`, `islands-worker.md`, `islands-frameworks.md`). A
worker owns the render loop against a proxy DOM; commits serialize to an
op stream the main-thread driver replays as real DOM mutations. Since the
0.1.9 dependency, **AtollJS is the engine**: the op protocol, proxy DOM,
instance lifecycle, worker definers, task transport, and driver are
`@atolljs/core` + `@atolljs/islands` code. Our packages are facades:

- **`@solid-mvc/atoll`** (`packages/atoll`) — thin shell/worker facades
  over `@atolljs/islands`. `.` = shell/mount entry (`mountIsland`,
  `connectIslandWorker`, `callbackProp`, contracts, `z`), `./worker` =
  worker-side entry (`definePolyWorker`/`defineMonoWorker`, `emit`,
  instance scope, proxy-DOM types).
- **`@solid-mvc/atoll-island`** (`packages/atoll-island`) — the
  `*-island` adapter package. `.` = shell surface (`<Island/>`,
  `islandComponent`, `lazyIsland`) plus re-exports of the driver/mount
  API; `./worker` = the SolidMVC renderer (`viewIslandApp`,
  `viewIsland`, `defineViewPolyWorker`, `defineViewMonoWorker`) plus
  re-exports of `emit`/instance scope so worker entries need no direct
  `@solid-mvc/atoll` import.

## Topology

```
main thread                          worker thread
───────────                          ─────────────
<Island/> / islandComponent
  └ mountIsland / connectIslandWorker ── task {method, instance, ...} ──▶ definePolyWorker({apps})
       ▲                                                                  │ runInInstance
       └──────── result{ops} / poll or push flushes ──────────────────────┘ render → ProxyDocument
                  driver.applyOp → real DOM                                    every mutation = one Op
```

- **Poly worker** (`definePolyWorker({ apps })`): one script, an app
  registry; islands pick an app by name. **Mono worker**
  (`defineMonoWorker(app)`): one script, one app; the name is ignored only
  when the registry holds exactly one app.
- **Instance** = one mounted island, keyed `app@N` (nested islands
  namespace as `parent~app@N`). Each instance has its own ProxyDocument,
  op queue, and handler table.
- **Two app shapes**: `RenderedIslandApp` (`{ mount(ctx) → { update?,
    sync?, dispose? } }`) — what our adapter produces — and
  `ImperativeIslandApp` (`{ imperative(doc, props), dispose? }`) — raw
  proxy-DOM programs with no framework.
- **Transport**: `mode: 'poll'` (default, message-only, no headers) or
  `mode: 'push'` (SharedArrayBuffer doorbell, requires COOP/COEP). Our
  facade defaults everything to poll because GitHub Pages cannot serve
  the isolation headers.

## Module map

| File | Pkg | Side | Role |
|---|---|---|---|
| `index.ts` | atoll | shell | re-exports `@atolljs/islands`: contracts (`defineIslandContract`, `withContract`, `contractOf`, `contractWorkerOf`), `islandApp`, `z`/`Schema`, wire types |
| `driver.ts` | atoll | main | wraps `mountIsland`/`connectIslandWorker`: `WorkerLike` normalization, `doorbell: false` + `mode: 'poll'` defaults |
| `worker.ts` | atoll | worker | re-exports `@atolljs/islands/worker` (definers, `emit`, `runInInstance`, proxy DOM) + `enterInstance`/`exitInstance` helpers |
| `shell.ts` | atoll-island | main | `<Island/>`, `islandComponent`, `lazyIsland`, contract facades, shell/island prop splitting |
| `renderer.ts` | atoll-island | worker | the `solid-js/universal` `createRenderer` bound to the ambient/proxy document + the JSX runtime module worker files compile against |
| `adapter.ts` | atoll-island | worker | `viewIslandApp`, `viewIsland`, `defineViewPolyWorker`, `defineViewMonoWorker`, per-key signal props, instance scoping |
| `index.ts`/`worker.ts` | atoll-island | both | entry points: index re-exports shell + driver API; worker re-exports adapter + renderer + `@solid-mvc/atoll/worker` |

## The contract facade

Atoll's cross-framework pattern (docs/atoll/blog/facades.md): one shared
module describes the island — app name, prop schema, event vocabulary,
worker factory — and both sides consume it.

```ts
// ticker.contract.ts — imported by shell AND worker entry
import { defineIslandContract, z } from '@solid-mvc/atoll-island';

export const tickerContract = defineIslandContract({
  app: 'ticker',
  props: z.object({ interval: z.number().optional() }),
  events: { 'worker-ping': z.object({ at: z.number() }) },
  worker: () => new Worker(
    new URL('../workers/ticker.worker.tsx', import.meta.url),
    { type: 'module' },
  ),
});
```

```tsx
// shell view — no worker plumbing at the call site
import { islandComponent } from '@solid-mvc/atoll-island';
import { tickerContract } from '../islands/ticker.contract';

const TickerIsland = islandComponent(tickerContract);

<TickerIsland interval={1000}
  onEvent={(name, payload) => { /* typed by the contract */ }} />
```

```ts
// worker entry — the same contract attaches to the app
import { defineViewPolyWorker, viewIslandApp } from '@solid-mvc/atoll-island/worker';
import { tickerContract } from '../islands/ticker.contract';

export const worker = defineViewPolyWorker({
  apps: { ticker: viewIslandApp(TickerView, { contract: tickerContract }) },
});
```

Rules:

- `islandComponent(contract)` derives the app name, uses the contract's
  `worker` factory when no `worker`/`client` prop is given, splits shell
  props (`className`, `onEvent`, `slots`, …) from island props, and types
  `onEvent` by the declared `events` map.
- `withContract(contract, app)` tags the worker-side app so mount props
  are validated against the schema and declared `emit` payloads are
  checked worker-side.
- The string-keyed forms still work: `islandComponent('ticker')`,
  `<Island app="ticker" worker={entry} />`, `viewIsland('name', App)`.
- `z` is Atoll's bundled schema mini-lib; any `safeParse`-shaped schema
  (real zod included) satisfies `Schema`.

## The pieces that make it work

- **Op replay** (Atoll driver): per-island `Map<nodeId, Node>` plus
  `listen` ops that attach real listeners and `dispatch` the handler id +
  serialized `EventPayload` back to the worker. `remove` ops tombstone the
  subtree's map entries into a bounded (1024) detached map — re-appended
  ids promote back, so the maps can't grow unboundedly on create/remove
  churn (tooltip text, transient overlays) and re-append keeps working.
  Dispatches ride an ordered queue capped at 4 in flight per island;
  move-type events (`mousemove`/`pointermove`/`touchmove`/`drag`/`dragover`)
  coalesce to the freshest queued position while boundary events never
  merge, so pointer sweeps can't pile up round-trips. The payload also carries
  `zrX`/`zrY` — `clientX/Y − currentTarget.getBoundingClientRect()`
  computed on the main thread — because the proxy DOM has no measurement
  channel for worker-side coordinate math; hit-testing libraries that
  early-out on those fields (zrender's `normalizeEvent`) get correct
  pointer-local coords, which is what makes echarts' axis pointer and
  tooltip work inside a worker.
- **Proxy DOM** (Atoll worker side): enough surface for the universal
  renderer's host contract — `createElement`, `createTextNode`,
  `insertBefore`, `removeChild`, `textContent`, `style`,
  `addEventListener`, `setAttribute`, sibling/parent traversal.
- **Universal renderer** (`renderer.ts`): `solid-js/universal`'s
  `createRenderer` bound to the ambient document — inside a task it
  resolves the instance's proxy doc through the dispatcher. The module
  also IS the JSX runtime worker files compile against
  (`generate: 'universal'`, `moduleName: '@solid-mvc/atoll-island/worker'`):
  compiled output calls its `createElement`/`insert`/`setProp`/`spread`/
  `effect`/`memo`/`createComponent` surface, and `createComponent` routes
  View classes through `viewComponent()` exactly like the DOM runtime.
  `setProperty` handles `on*` props by attaching real listeners with the
  lowercase DOM type — universal output never hits the `'onclick' in el`
  probe problem Preact had, so no event-name bridge is needed.
- **`sync` lane** (`adapter.ts`): rendered handles may provide `sync(fn)`;
  the dispatch task runs the event handler inside the instance scope.
  Solid flushes signal effects synchronously, so handler-driven DOM writes
  land in this task's op batch on their own — no re-render pass to force.
  Effects that fire on EVERY dispatch (zrender viewport mousemove
  included) still mean render-driven side effects (chart `setOption`,
  emits) must be reference-guarded.
- **Render scoping** (`renderer.ts`): mount/update run in
  `runInInstance`, but signal writes from timers flush effects with no
  task wrapper. `registerInstanceDoc(doc, instance)` tags each mount's
  proxy document; `insert` wraps its accessor so out-of-task evaluation
  `enterInstance`s the owning document's instance — the Solid analog of
  the old vnode-stamp scope walk, scoped through the insertion boundary
  instead. Deterministic, strictly better than the ambient heuristic.
- **Per-key signal props** (`adapter.ts`): wire props arrive on a Proxy
  whose every key is a `createSignal`; `updateProps` writes only changed
  keys, so the DOM patch is exactly as fine-grained as the reads —
  one text/attr op per changed dependent, never a rebuild.
- **DI in islands**: `viewIslandApp` creates a fresh root `Injector` per
  mount inside `InjectorContext.Provider`; `@Component({ providers,
  imports, controllers })` metadata works unchanged — worker-side stores
  and controllers live in the worker.
- **Registries are a module-level union in-process**: Atoll's
  `APP_REGISTRY` is global, which is right in real workers (each entry is
  its own module graph) but means in-process tests see every def's apps.
  Consequence: the mono name-fallback only kicks in for a single-app
  registry, so tests mount mono apps by their registry key.
- **View props**: `Injector.instantiate(cls, props)` passes the signal
  proxy to the constructor so field initializers
  (`signal(this.props.start)`) see initial values.

## Shell usage

```tsx
// worker entry (worker side)
export const worker = defineViewPolyWorker({
  apps: { counter: CounterIsland, clock: ClockIsland },
});

// shell
const Counter = islandComponent<{ start?: number }>('counter');
<Counter worker={() => new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' })}
         props={{ start: 0 }} onEvent={(n, p) => log(n, p)} />

// or share one worker across islands
const client = connectIslandWorker({ worker: islandEntry });
<Island client={client} app="clock" />
```

`mountIsland` handle: `{ app, instance, pid, updateProps, flush, destroy,
setMode }`. Functions in props must be wrapped in `callbackProp(fn)`; a
bare function prop rejects at marshal time. `destroy()` tears down the
worker instance and stops the transport; the driver still replays the
unmount batch's `clear` op so `slots[name]` callbacks fire with `null`
and slot render roots unmount — without that a slot-hosted sibling island
would keep `clientMounts` above zero and pin a shared worker alive.

## Worker-hosted pages (enterprise example)

`examples/enterprise` pushes the pattern furthest: EVERY routed page is
an island app on its OWN worker — a heavy page can't stall a sibling's
renders, and each worker bundles only its page's code. The dashboard
goes one level deeper: the page renders inside `dashboard.worker.tsx`
and its chart and ticker islands are SUB-islands — real nested workers
(`dashboard@1~chart@N`, `dashboard@1~ticker@N`) spawned from inside the
dashboard worker, whose ops and events tunnel through the parent's
stream to the main driver. The pieces:

- `src/workers/<page>.worker.tsx` registers each worker-hosted page's
  apps with `viewIslandApp(View, { providers })`; `src/workers/shared.ts`
  builds the per-worker provider spine (`FakeApi` + a `QueryClient`
  synced over BroadcastChannel). Each worker's cache is its own; the
  sync is key-scoped (`SHARED_QUERY_KEYS`) and delta-shaped — only the
  query that changed is dehydrated per event, and only whitelisted key
  prefixes cross the channel.
- `PageWorkerHost` (service) owns one `IslandClient` PER PAGE, connected
  lazily: `clientFor(app)` maps the app name to that page's `new
  Worker(new URL(...))` literal (the factory record keeps every entry
  bundler-detectable). Route components in `routes.tsx` are thin
  `() => <WorkerPage app={app} />` hosts, and `WorkerPage` mounts
  `<Island client={host.clientFor(app)} app={app}>`. Every client
  connects with `keepAlive: true`: navigating away unmounts the page
  instance — lifecycle stops, timers clear, nested sub-workers still die
  with their parent view — but the worker thread stays resident and
  idle, so returning is a warm start on a live thread whose module
  graph and QueryClient were never thrown away. The workers double as
  lazy loaders: a page's bundle only evaluates on first spawn, and its
  data caches stay warm for the session. All clients still terminate
  with the app scope.
- Sub-islands need no new plumbing: a contract's own `worker` factory
  uses the same `new Worker(new URL(...))` literal, and when the
  factory runs inside a worker bundle the bundler resolves it to a
  nested worker chunk. `<Chart>`/`<Ticker>` inside `DashboardView` hit
  `mountIsland` with a `ProxyElement` target, which delegates to the
  registered `mountSubIsland` — the child worker's ops tunnel up and
  replay through the parent's op stream; child `emit()` events route
  back down to the parent's `onEvent`. Theme still lives main-thread:
  `WorkerPage` passes `dark` as a mount prop to the dashboard island,
  and the view forwards it to the chart sub-island as a plain prop.
  Caveat: Safari workers cannot spawn workers — nested sub-islands need
  a fallback mount (top-level islands) on WebKit.
- The revenue chart (`chart.worker.tsx` + `chart.contract.ts`) is
  props-driven: the dashboard's query result crosses the sub-island
  boundary as `data` (a `number[]`), `dark` re-initializes the theme on
  toggle. Its mount element is the chart box itself — the real
  element's measured box forwards down as the sub-island's pushed
  container size. Geometry reads are asynchronous over the wire:
  `clientWidth`/`getComputedStyle` return 0/empty until the driver's
  first `setRects` push (and warn once per feature). `bind()` therefore
  defers `echarts.init` to the first non-empty `doc.observeSize` rect
  and unsubscribes; later resizes ride `doc.onResize` → `chart.resize()`.
  Any layout-measuring library in a worker should init the same way —
  `observeSize(el, cb)` is the synchronous-read-free channel. echarts uses
  its SVG renderer with modular imports (`echarts/core` + LineChart +
  Grid + Tooltip + AxisPointer + SVGRenderer): every shape is a
  `createElementNS`/`attr`/`style` op, and zrender's
  `ownerDocument.defaultView.getComputedStyle` resolves through the
  worker window facade, which only exists after `installDomShim(doc)`
  runs. `AxisPointerComponent` is required: its view owns the
  `globalListener` record that turns zrender `globalout` into
  `updateAxisPointer(leave)` — without it an axis tooltip shows but
  never hides.
  Tooltip: use `renderMode: 'richText'` so the tooltip draws inside the
  svg. The default `'html'` mode is a div whose `show()` writes
  `style.cssText` and `hide()` writes `style.visibility`/`opacity`;
  richText hides are zrender attr ops — no DOM tooltip element, no
  style-facade interaction, less wire traffic. The island also
  dispatches `hideTip` on container `mouseleave` as idempotent
  insurance inside the dispatch task.
  Caveat: zrender hover state swaps (`emphasis`/`blur`/`select`) replace
  `el.style` wholesale with the state's style object, whose attrs then
  diff out via `attr` ops with `value: null`. When the state style lacks
  the normal paint keys (echarts resolves emphasis styles independently
  of the normal style), the series loses `stroke`/`fill` and the restore
  path does not always bring it back: the series renders invisible after
  hover. The example sets `emphasis.disabled`/`select.disabled` since the
  emphasis look adds nothing (no symbols, same stroke). If emphasis is
  needed, give the emphasis state an explicit complete style.
- The ticker (`ticker.worker.tsx` + `ticker.contract.ts`) — same mount
  mechanics as the chart; its `emit('worker-ping', …)` events reach the
  dashboard controller's `onEvent` handler through the tunnel in one
  hop.
- Query caches sync across threads without island plumbing:
  `lib/broadcast-query.ts` mirrors TanStack's removed v4
  `broadcastQueryClient` (v5's persist-client-core takes AsyncStorage,
  not a channel) — `queryCache` events dehydrate onto a
  `BroadcastChannel` (native worker/main reach) and hydrate elsewhere,
  with a `hydrating` flag breaking the echo loop. The shell proves it
  end-to-end: `ShellController` observes `['metrics']` with
  `queryFn: skipToken` (never fetches) yet renders revenue hydrated
  purely from the dashboard worker's broadcasts.

## Testing

`@atolljs/core/testing/inProcessWorker` runs the real INIT/EXECUTE_TASK
protocol in the test realm — `vi.stubGlobal('Worker', InProcessWorker)`
plus the worker defs registering into the shared `TaskRegistry`. Two
in-process caveats:

- **Single realm**: `@atolljs/core` ships `dist/` for the bare specifier
  but `src/*` for subpaths — two `TaskRegistry` instances. The root
  `vitest.config.ts` aliases the bare specifier into `src` so islands and
  the harness share one registry.
- **Global shadowing**: the worker's instance dispatcher installs
  `document`/`window`/`Element`/… getters that resolve the ambient proxy
  doc; out-of-task shell code (the driver, the test) would see proxies.
  The test captures jsdom's globals before defining workers and hands
  them back through the dispatcher's documented override setters.

## Deliberate divergences from Atoll

- **Defaults are message-only**: `doorbell: false`, `mode: 'poll'` —
  GitHub Pages can't serve COOP/COEP; opt into `push` where headers allow.
- **`worker:` accepts a `WorkerLike` or factory**: the facade normalizes
  already-spawned workers (test doubles) to entries; the factory form
  `() => new Worker(new URL('./x.worker.ts', import.meta.url))` stays
  mandatory for real bundler-detectable entries.
- **Single renderer**: only the Solid view adapter; no react/vue/angular
  island packages.
- **No event-name bridge needed**: the universal renderer's `setProperty`
  receives `on*` props already split, so listeners attach with real DOM
  types — Preact's `'on*' in el` probe problem doesn't exist here.

## Invariants

- One island instance = one isolated op stream; `app@N` keys everything.
- Everything crossing the wire is structured-cloneable (props, payloads,
  ops); functions only as marshalled `callbackProp` tokens.
- DOM work outside a task must re-enter via `runInInstance` (or the
  `registerInstanceDoc`/`insert` scoping path) — ambient `document`
  out-of-scope is a documented heuristic, not a contract.
- `preventDefault`/`stopPropagation` on dispatched events are synthesized
  no-ops: the real event already ran on the main thread.
- Real-worker entries must stay bundler-detectable: inline
  `new Worker(new URL('…', import.meta.url), { type: 'module' })`.
- `data-atoll-slot` attrs route to `slots` callbacks for transclusion.
- `keepAlive` keeps a CLIENT'S worker resident after its last island
  unmounts — it does not dedupe mounts. A `<Ticker client={...}>` facade
  that connects per mount leaks a worker each time: the old thread stays
  resident AND the new client spawns another. Pair keepAlive with a
  client that outlives the mount — a service-held client for page
  workers, a module-scope `Map` in the worker realm for sub-islands
  (see `examples/enterprise/src/lib/sub-workers.ts`: the module only
  exists in the worker bundle, so its clients survive app-instance
  unmount as long as the page worker itself is resident).
- `pool sent INIT without memory, but shared-memory contracts are defined`
  is benign in `poll` mode: `@atolljs/islands` declares the doorbell
  contract (`renderMemory`) at module scope unconditionally, and the
  warning can't tell it apart from user contracts that would actually
  throw. `bumpOpsVersion` guards on `doorbell.bound`, so the doorbell is
  simply inert. The fix is `mode: 'push'` + COOP/COEP headers — not
  patchable from our code, and `definePolyWorker({ sharedMemory })` only
  swaps the contract instance, it can't skip declaring it.
- **Worker bundles get their own plugin list.** Vite 6 does NOT inherit
  `config.plugins` for `new Worker(...)` bundles — `worker.plugins` must
  return the solid plugin explicitly or every .tsx inside the worker
  falls back to esbuild's classic JSX (`React.createElement`, mount
  crashes). Everything reachable from a worker entry compiles
  `generate: 'universal'` — the whole bundle is proxy-DOM code, so no
  file-glob split inside `worker.plugins`. `worker.format: 'es'` is also
  required: the `iife` default empties `import.meta`, which breaks the
  nested `new Worker(new URL(...))` sub-island entries inside page
  workers.
- **Dev mode needs importer-graph tagging, not filename globs.** In dev,
  modules transform individually and worker entries arrive as
  `?worker_file` URLs; nothing about `dashboard.view.tsx` or
  `ui/*.tsx` says "compile me universal". `workerUniversalTag()`
  (`@solid-mvc/atoll-island/vite`) stamps `?smvc-worker` onto every
  module reachable from a `.worker.`/`.island.` entry (the marker rides
  through `.ts` intermediates too), and `WORKER_FILES` includes the tag
  regex so the universal plugin's `include` and the DOM plugin's
  `exclude` both catch it. The tagged id is a second module instance —
  the same file keeps its clean DOM compile for the shell graph.
- **SVG needs a tag-name rule in universal render.** The universal
  transform emits `createElement("svg")` with no namespace argument —
  there is no parent context at element creation. The renderer maps
  SVG-only tags (svg, circle, path, g, …) to `doc.createElementNS` so
  the `create` op carries `ns` and the driver replays real SVG; an
  html-namespaced `<svg>` silently renders as 0×0. Tags that exist in
  BOTH HTML and SVG (a, font, image, script, style, title) stay HTML —
  an svg-namespaced `<a>` in a view would break real HTML. `Dynamic`
  (`lucide-solid` icon bodies) resolves ns itself via `SVGElements`.
- **Never tag prebundled deps.** `?smvc-worker` on a `/node_modules/
  .vite/deps/*` id or a compiled `.js`/`.mjs` under `node_modules` gives
  the worker realm TWO instances of that dep (tagged + untagged) — and
  when the dep is the Solid reactive core, effects silently die and
  islands render their mount batch then freeze. The tagger skips those
  ids; raw `.ts`/`.tsx`/`.jsx` sources under `node_modules` (e.g.
  `lucide-solid`) still get tagged because they need the universal
  compile.
- **The worker tag doubles the dev module graph.** Every tagged module
  is a second fetched/compiled copy of the file, so barrel imports cost
  twice in dev: `import { Check } from 'lucide-solid'` fetched all
  ~1,750 per-icon modules on the main thread AND again tagged for the
  worker realm (~3,500 requests on the dashboard). Deep-import icons
  (`lucide-solid/icons/check`, default export) — same `solid` condition
  resolution, ~one request per icon per realm. Do NOT `optimizeDeps`
  lucide-solid to work around it: the prebundled `.mjs` calls
  `solid-js/web` DOM helpers, which is the wrong realm in a worker.
