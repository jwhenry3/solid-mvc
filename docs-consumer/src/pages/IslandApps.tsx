import { CodeBlock, CodeSideContext } from '../components/CodeBlock';
import { docHref } from '../link';

export function IslandApps() {
  return (
    <CodeSideContext.Provider value="worker">
      <article>
        <h1>Island apps</h1>
        <p class="lead">
          An island app is a view tree packaged for the worker: a worker entry
          registers it with a definer, the shell mounts it by name, and
          props/events cross the wire in both directions.
        </p>

        <h2>Define the worker entry</h2>
        <p>
          Two definers, same apps map — <em>poly</em> hosts a registry of
          named apps (many apps per worker), <em>mono</em> dedicates the
          worker to one:
        </p>
        <CodeBlock
          file="dashboard.worker.tsx"
          language="tsx"
          code={`import { defineViewPolyWorker } from '@solid-mvc/atoll-island/worker';
import { TickerIsland } from './ticker';
import { MetricsIsland } from './metrics';

// One worker entry hosts every island app this file exports a view for.
export const worker = defineViewPolyWorker({
  apps: { ticker: TickerIsland, metrics: MetricsIsland },
});`}
        />
        <CodeBlock
          file="solo.worker.tsx"
          language="tsx"
          code={`import { defineViewMonoWorker } from '@solid-mvc/atoll-island/worker';
import { EditorIsland } from './editor';

export const worker = defineViewMonoWorker(EditorIsland);`}
        />
        <blockquote>
          <p>
            The shell imports the entry only as a type —
            <code>import type {'{'} worker {'}'} from './x.worker'</code> —
            and spawns it with the inline{' '}
            <code>new Worker(new URL('./x.worker.tsx', import.meta.url), {'{'} type: 'module' {'}'})</code>{' '}
            literal so the bundler can detect it.
          </p>
        </blockquote>

        <h2>Everything inside works the same</h2>
        <p>
          The worker compiles JSX for Solid's universal renderer against{' '}
          <code>@solid-mvc/atoll-island/worker</code>, so the framework is
          unchanged in the worker:{' '}
          <code>@Component</code>/<code>View</code> construction,{' '}
          <code>inject()</code> into the island's own root injector, signals,
          and lifecycle all behave exactly as on the main thread.
        </p>
        <CodeBlock
          file="metrics.tsx"
          language="tsx"
          code={`@Component()
export class MetricsIsland extends View<{ source?: string }> {
  private points = signal<number[]>([]);
  private timer?: ReturnType<typeof setInterval>;

  onInit() {
    // Timers/signals outside an event task still update: each tracked
    // write re-syncs the DOM and ships an op batch to the shell
    // (an "unsolicited" push).
    this.timer = setInterval(() =>
      this.points.value = [...this.points.value.slice(-59), sample()], 1000);
  }
  onDestroy() { clearInterval(this.timer); }

  render() {
    return <Sparkline points={this.points.value} label={this.props.source} />;
  }
}`}
        />

        <h2>viewIsland — stamped app references</h2>
        <p>
          <code>viewIsland(name, App)</code> stamps an app so shell code can
          pass the reference itself instead of a registry string — the
          reference carries its own name (and optional island-scoped
          providers via{' '}
          <code>viewIslandApp(App, {'{'} providers {'}'})</code>):
        </p>
        <CodeBlock
          language="tsx"
          code={`export const tickerApp = viewIsland('ticker', TickerIsland);

// shell: <Island app={tickerApp} worker={tickerWorker} />
// name comes from the stamp — no string to drift out of sync.`}
        />

        <h2>viewIslandApp — the contract attach</h2>
        <p>
          For full facade decoupling, the contract module both sides import
          gets attached to the app at registration: mount/updateProps props
          are validated against its schema and every declared{' '}
          <code>emit</code> payload is checked worker-side before it goes on
          the wire:
        </p>
        <CodeBlock
          file="ticker.contract.ts"
          language="ts"
          code={`import { defineIslandContract, z } from '@solid-mvc/atoll-island';

export const tickerContract = defineIslandContract({
  app: 'ticker',
  props: z.object({ source: z.string().optional() }),
  events: { 'worker-ping': z.object({ ticks: z.number() }) },
  worker: () =>
    new Worker(new URL('./ticker.worker.tsx', import.meta.url), {
      type: 'module',
    }),
});`}
        />
        <CodeBlock
          file="ticker.worker.tsx"
          language="tsx"
          code={`export const worker = defineViewPolyWorker({
  apps: {
    ticker: viewIslandApp(TickerIsland, { contract: tickerContract }),
  },
});`}
        />
        <p>
          <code>z</code> is Atoll's bundled schema mini-lib, re-exported so
          no extra dependency is needed; any <code>safeParse</code>-shaped
          schema (real zod included) satisfies <code>Schema</code>. The
          shell then mounts <code>islandComponent(tickerContract)</code>{' '}
          with fully typed props and events — see{' '}
          <a href={docHref('island-shell')}>Shell &amp; mounting</a>.
        </p>
        <p>
          <code>viewIsland(name, App)</code> stamps an app so shell code can
          pass the reference itself instead of a registry string — the
          reference carries its own name (and optional island-scoped
          providers via{' '}
          <code>viewIslandApp(App, {'{'} providers {'}'})</code>):
        </p>
        <CodeBlock
          language="tsx"
          code={`export const tickerApp = viewIsland('ticker', TickerIsland);

// shell: <Island app={tickerApp} worker={tickerWorker} />
// name comes from the stamp — no string to drift out of sync.`}
        />

        <h2>Talking to the shell: emit()</h2>
        <CodeBlock
          code={`// worker side — any event name + structured-cloneable payload:
emit('milestone', { count: this.count.value });

// shell side receives every emit through onEvent:
<Island app="ticker" worker={w} onEvent={(name, payload) => {
  if (name === 'milestone') notify(payload);
}} />`}
        />

        <h2>Receiving callbacks: callbackProp</h2>
        <CodeBlock
          language="tsx"
          side="shell"
          code={`<Island
  app="editor" worker={w}
  props={{ onSave: callbackProp((doc) => save(doc)) }}
/>`}
        />
        <CodeBlock
          language="tsx"
          code={`// worker side — props.onSave is a real function; calling it posts back
// to the shell and returns a Promise of the shell fn's return value:
async save() {
  const result = await this.props.onSave(this.document.value);
}`}
        />
        <p>
          Only functions wrapped in <code>callbackProp</code> cross — raw
          function props fail structured-clone on the wire.
        </p>
      </article>
    </CodeSideContext.Provider>
  );
}
