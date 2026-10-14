import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Islands() {
  return (
    <article>
      <h1>Islands</h1>
      <p class="lead">
        Worker-rendered UI islands: real SolidMVC view trees — View classes,
        signals, DI, lifecycle — running inside a Web Worker, streamed to the
        shell DOM over a serialized op protocol. The main thread stays free;
        the island looks and behaves like an ordinary element.
      </p>

      <h2>The shape</h2>
      <CodeBlock
        language="plaintext"
        code={`shell thread                          worker thread
┌────────────────────────┐ postMessage  ┌─────────────────────────┐
│ <Island app="ticker"   │ ◀──────────  │ ProxyDocument — the     │
│   worker={entry}/>     │   ops        │ only "DOM" a worker sees│
│        │               │              │        │                │
│   driver.ts — replays  │  events ───▶ │   Solid render of the   │
│   ops onto real DOM    │              │  island's view tree     │
└────────────────────────┘              └─────────────────────────┘`}
      />
      <p>
        Two threads, two halves of the package:{' '}
        <code>@solid-mvc/atoll-island</code> is the shell surface,{' '}
        <code>@solid-mvc/atoll-island/worker</code> is the worker entry. The
        engine underneath is the real Atoll — <code>@solid-mvc/atoll</code>{' '}
        is a thin facade over <code>@atolljs/islands</code> +{' '}
        <code>@atolljs/core</code> (op protocol, proxy DOM, driver) — and the
        adapter is the piece that knows how to render View classes into it.
      </p>

      <h2>Sixty seconds of it working</h2>
      <CodeBlock
        file="ticker.worker.tsx"
        language="tsx"
        side="worker"
        code={`import { Component, View, signal } from '@solid-mvc/core';
import { defineViewPolyWorker, emit } from '@solid-mvc/atoll-island/worker';

@Component()
export class TickerIsland extends View {
  private ticks = signal(0);
  onInit() {
    setInterval(() => this.ticks.value++, 1000);  // out-of-task pushes
  }
  render() {
    return (
      <button onClick={() => emit('ping', { ticks: this.ticks.value })}>
        ticks: {this.ticks.value}
      </button>
    );
  }
}

export const worker = defineViewPolyWorker({ apps: { ticker: TickerIsland } });`}
      />
      <CodeBlock
        file="dashboard.view.tsx"
        language="tsx"
        side="shell"
        code={`import { Island } from '@solid-mvc/atoll-island';
import type { WorkerLike } from '@solid-mvc/atoll-island';

// Literal new URL — Vite must see it to emit the worker bundle.
const tickerWorker = (): WorkerLike =>
  new Worker(new URL('../workers/ticker.worker.tsx', import.meta.url), {
    type: 'module',
  }) as WorkerLike;

// inside a view's render():
<Island
  app="ticker"
  worker={tickerWorker}
  onEvent={(name, payload) => console.log('island says', name, payload)}
/>`}
      />
      <p>
        The button ticks once a second <em>in the worker</em> — each tracked
        signal write re-syncs its proxy DOM and ships an op batch; clicking it emits{' '}
        <code>ping</code> back to the shell's <code>onEvent</code>. The shell
        never coordinates any of it.
      </p>

      <h2>The contract facade</h2>
      <p>
        The recommended shape fully decouples the two sides: one shared
        module describes the island — app name, prop/event schemas, worker
        factory — and shell and worker each import only that. The call site
        mounts a facade component with <em>no</em> worker plumbing:
      </p>
      <CodeBlock
        file="ticker.contract.ts"
        language="ts"
        code={`import { defineIslandContract, z } from '@solid-mvc/atoll-island';

export const tickerContract = defineIslandContract({
  app: 'ticker',
  events: { 'worker-ping': z.object({ ticks: z.number() }) },
  worker: () =>
    new Worker(new URL('./ticker.worker.tsx', import.meta.url), {
      type: 'module',
    }),
});`}
      />
      <CodeBlock
        language="tsx"
        side="shell"
        code={`import { islandComponent } from '@solid-mvc/atoll-island';
import { tickerContract } from './ticker.contract';

const Ticker = islandComponent(tickerContract);

// No worker prop — the contract carries the factory. onEvent narrows to
// the declared event vocabulary, props to the declared schema.
<Ticker onEvent={(name, payload) => log(name, payload)} />`}
      />
      <CodeBlock
        language="tsx"
        side="worker"
        code={`// Attach the same contract worker-side: mount/updateProps props are
// schema-validated and declared emit payloads are checked.
export const worker = defineViewPolyWorker({
  apps: { ticker: viewIslandApp(TickerIsland, { contract: tickerContract }) },
});`}
      />

      <h2>What an island is good for</h2>
      <ul>
        <li>
          <strong>Continuous or heavy renderers</strong> — tickers, log
          tailers, live charts: work that would jank the shell runs
          off-thread entirely.
        </li>
        <li>
          <strong>Isolation boundaries</strong> — an untrusted or crash-prone
          subtree can't take down the shell; terminating the worker is a
          clean kill.
        </li>
        <li>
          <strong>Micro-frontends</strong> — a worker entry can host several
          island apps (<code>defineViewPolyWorker</code>), one worker serving
          many independently-propped instances.
        </li>
      </ul>

      <h2>Honest constraints</h2>
      <ul>
        <li>
          The wire is <code>postMessage</code>/<code>structuredClone</code>:
          props and event payloads must be cloneable; functions cross only as{' '}
          <code>callbackProp</code> markers.
        </li>
        <li>
          The worker is DOM-free: no <code>document</code>, no canvas
          interop, no layout queries — the proxy DOM only knows how to
          serialize mutations.
        </li>
        <li>
          The default transport is message-only (<code>mode: 'poll'</code>).
          The push mode's SharedArrayBuffer doorbell is faster but needs
          cross-origin isolation headers (COOP/COEP) — which static hosts
          like GitHub Pages can't serve.
        </li>
      </ul>
      <p>
        Shell CSS <em>does</em> apply to island contents: ops replay real
        elements inside the island container, so ordinary classes (Tailwind
        utilities included) work in worker markup.
      </p>

      <p>
        Next: <a href={docHref('island-apps')}>writing island apps</a>,{' '}
        <a href={docHref('island-shell')}>mounting from the shell</a>, or{' '}
        <a href={docHref('island-protocol')}>how the protocol works</a>.
      </p>
    </article>
  );
}
