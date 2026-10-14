import { CodeBlock, CodeSideContext } from '../components/CodeBlock';
import { docHref } from '../link';

export function IslandShell() {
  return (
    <CodeSideContext.Provider value="shell">
      <article>
        <h1>Shell &amp; mounting</h1>
        <p class="lead">
          The shell side is <code>@solid-mvc/atoll-island</code> (the package
          root): mount an island as an element, pass props and callbacks,
          receive events. Three mounting surfaces cover the common cases.
        </p>

        <h2>islandComponent(contract) — the facade</h2>
        <p>
          The recommended mount. The contract module names the app, declares
          the wire schemas, and carries the worker factory — so the call
          site passes <em>no</em> worker plumbing, and props/events typecheck
          against the contract:
        </p>
        <CodeBlock
          language="tsx"
          code={`import { islandComponent } from '@solid-mvc/atoll-island';
import { tickerContract } from './ticker.contract';

const Ticker = islandComponent(tickerContract);

// onEvent narrows to the contract's declared events; island props are
// the contract's props schema. No worker prop — the contract carries it.
<Ticker
  source="orders"
  onEvent={(name, payload) => {
    if (name === 'worker-ping') notify(payload);
  }}
/>`}
        />
        <blockquote>
          <p>
            The string-keyed form still exists —{' '}
            <code>islandComponent('ticker')</code> — for registries whose
            workers the shell already wires up.
          </p>
        </blockquote>

        <h2>&lt;Island&gt; — the primitive</h2>
        <CodeBlock
          language="tsx"
          code={`import { Island } from '@solid-mvc/atoll-island';
import type { WorkerLike } from '@solid-mvc/atoll-island';

const tickerWorker = (): WorkerLike =>
  new Worker(new URL('./ticker.worker.tsx', import.meta.url), {
    type: 'module',
  }) as WorkerLike;

<Island
  app="ticker"                    // registry key, stamped ref, or contract
  worker={tickerWorker}           // omit when app is a contract with worker
  props={{ source: 'orders' }}    // structured-cloneable
  onEvent={(name, payload) => log(name, payload)}
  mode="poll"                     // 'push' needs COOP/COEP isolation headers
  onReady={(handle) => handle.updateProps({ source: 'live' })}
  onError={(err) => show(err)}
  className="metric-card"
/>`}
        />
        <p>
          <code>worker</code> accepts a <code>WorkerLike</code> directly or a
          factory — use the factory form in real code so Vite detects the
          entry. When <code>app</code> is a contract that carries a{' '}
          <code>worker</code>, the contract module is the whole connection.
          Unmounting the element terminates an owned worker.
        </p>

        <h2>Shared workers: one client, many islands</h2>
        <p>
          A poly worker can host several islands at once — connect once, hand
          the client to each mount:
        </p>
        <CodeBlock
          language="tsx"
          code={`import { connectIslandWorker, Island } from '@solid-mvc/atoll-island';

const client = connectIslandWorker({
  worker: () =>
    new Worker(new URL('./dash.worker.tsx', import.meta.url), {
      type: 'module',
    }) as WorkerLike,
});

// Each mount is an isolated instance inside the shared worker:
<Island client={client} app="ticker" props={{ source: 'orders' }} />
<Island client={client} app="ticker" props={{ source: 'payments' }} />
<Island client={client} app="metrics" />`}
        />
        <p>
          Instances are keyed <code>app@N</code> in the worker — separate
          view trees, separate state, separate props, one worker process.
        </p>

        <h2>lazyIsland — code-split facades</h2>
        <p>
          Lazy-loads a module that exports a contract (or a stamped app) —
          ideal for keeping a contract's worker factory and schema out of
          the initial bundle's critical path:
        </p>
        <CodeBlock
          language="tsx"
          code={`const HeavyChart = lazyIsland(() => import('./heavy-chart.contract'));

// The contract module loads on first mount; fallback renders meanwhile.
<HeavyChart dataset="q4" fallback={<Skeleton />} />`}
        />
        <blockquote>
          <p>
            If you reference a stamped app instead of a contract, import it
            with <code>import type</code> in shell code — a worker definition
            must never leak into the main-thread bundle (defining one
            installs instance globals).
          </p>
        </blockquote>

        <h2>Imperative: mountIsland</h2>
        <p>
          For non-JSX integration (a portal, a vanilla container, tests),{' '}
          <code>mountIsland</code> attaches to any element and returns a
          handle:
        </p>
        <CodeBlock
          language="tsx"
          code={`const handle = await mountIsland({
  el,
  worker: tickerWorker,
  app: 'ticker',
  props: { source: 'orders' },
  onEvent: (name, p) => console.log(name, p),
});

handle.updateProps({ source: 'payments' }); // re-sync with new props
handle.destroy();                            // teardown + worker cleanup`}
        />

        <h2>Events back to the shell</h2>
        <p>
          Everything the worker <code>emit()</code>s arrives at{' '}
          <code>onEvent(name, payload)</code>; shell functions cross in the
          other direction via <code>callbackProp</code> — details in{' '}
          <a href={docHref('island-apps')}>Island apps</a>. Instance scoping
          and the op wire are in{' '}
          <a href={docHref('island-protocol')}>How it works</a>.
        </p>
      </article>
    </CodeSideContext.Provider>
  );
}
