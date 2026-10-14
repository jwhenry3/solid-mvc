import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function IslandProtocol() {
  return (
    <article>
      <h1>How it works</h1>
      <p class="lead">
        The worker never touches DOM. It renders into a proxy document whose
        every mutation serializes to an op; the main-thread driver replays
        those ops onto real nodes and routes real events back. Everything
        else — instances, emit, callbacks — is built on that one stream.
      </p>
      <p>
        That engine is the real Atoll: <code>@atolljs/islands</code> +{' '}
        <code>@atolljs/core</code> implement the op protocol, proxy DOM,
        instance lifecycle, and driver. <code>@solid-mvc/atoll</code> is a
        thin facade that re-exports them with our transport defaults, and{' '}
        <code>@solid-mvc/atoll-island</code> adds the framework binding.
      </p>

      <h2>The op protocol</h2>
      <p>
        A small vocabulary covers every DOM effect (Atoll's ops — see{' '}
        <code>docs/atoll/</code> in the repo for the original architecture
        docs):
      </p>
      <table class="doc-table">
        <thead>
          <tr><th>Op</th><th>Effect on the shell DOM</th></tr>
        </thead>
        <tbody>
          <tr><td><code>create</code></td><td>Allocate a node id for a tag/text node</td></tr>
          <tr><td><code>text</code></td><td>Set a text node's data</td></tr>
          <tr><td><code>append</code> / <code>insertBefore</code> / <code>remove</code></td><td>Tree structure</td></tr>
          <tr><td><code>attr</code> / <code>style</code></td><td>Attributes and inline style</td></tr>
          <tr><td><code>listen</code></td><td>Register a handler id for an event name on a node</td></tr>
          <tr><td><code>emit</code></td><td>Worker → shell named event (lands on <code>onEvent</code>)</td></tr>
        </tbody>
      </table>

      <h2>The proxy DOM</h2>
      <p>
        Inside the worker, <code>document</code> resolves to a{' '}
        <code>ProxyDocument</code> — enough of the DOM surface for the universal renderer to
        render against (<code>createElement</code>,{' '}
        <code>createTextNode</code>, <code>insertBefore</code>,{' '}
        <code>removeChild</code>, <code>data</code>, <code>innerHTML</code>,{' '}
        <code>style</code>, <code>addEventListener</code>) where every method
        appends ops to the instance's queue instead of mutating anything.
      </p>
      <CodeBlock
        side="worker"
        code={`// Inside the worker, this Solid render:
<button onClick={inc}>count: {n}</button>

// …serializes to roughly:
//   create #1 'button'
//   create #2 text 'count: 0'
//   append #1 <- #2
//   listen #1 'click' handler#7
//   append body <- #1`}
        language="tsx"
      />

      <h2>Instance scoping</h2>
      <p>
        Each mounted island is an instance keyed <code>app@N</code> with its
        own op queue, handler table, and proxy document. Ambient{' '}
        <code>document</code> in worker code resolves through the
        active-instance dispatcher: each mounted app registers its proxy
        document and <code>enterInstance</code> scopes DOM evaluation
        (renders, event handlers, out-of-task writes), so concurrent
        islands in one worker never cross streams.
      </p>
      <p>
        Timer/signal-driven updates happen <em>outside</em> any dispatched
        task: tracked writes re-sync the island, the instance re-enters its
        scope, and the op batch pushes to the shell unsolicited — that's why
        a worker clock keeps ticking with zero shell involvement.
      </p>

      <h2>Events: shell → worker</h2>
      <p>
        The driver attaches real listeners for every <code>listen</code> op.
        A DOM event serializes into a small payload (type, target node id,
        plus the fields islands care about) and posts to the worker, which
        looks up the handler id and invokes the registered listener — the
        same function the app attached.
      </p>

      <h2>Mount lifecycle</h2>
      <p>
        <code>connectIslandWorker</code> wraps the worker in a tiny RPC
        client (mount/updateProps/dispatch/setSize/unmount).{' '}
        <code>mountIsland</code> sends the app name + initial props, replays
        ops as they stream back, wires <code>ResizeObserver</code> to push
        size changes into the worker, and enforces a mount timeout so a
        failed worker surfaces as an error state instead of a blank box.
      </p>

      <h2>Transport: poll vs push</h2>
      <p>
        Two flush modes decide how op batches leave the worker.{' '}
        <code>mode: 'poll'</code> (the default) is pure{' '}
        <code>postMessage</code> — the driver polls the worker's op queue on
        a short interval, so nothing but a plain worker entry is needed.{' '}
        <code>mode: 'push'</code> rings a SharedArrayBuffer doorbell for
        immediate flush, but SAB requires cross-origin isolation headers (
        <code>Cross-Origin-Opener-Policy: same-origin</code> +{' '}
        <code>Cross-Origin-Embedder-Policy: require-corp</code>) — hosts like
        GitHub Pages can't serve them, so poll is the default everywhere.
        Push mode is opt-in per mount: <code>mode: 'push'</code> on{' '}
        <code>&lt;Island&gt;</code>, or <code>doorbell: true</code> on{' '}
        <code>connectIslandWorker</code>.
      </p>

      <h2>Contract enforcement</h2>
      <p>
        When a worker entry attaches a contract (
        <code>viewIslandApp(App, {'{'} contract {'}'})</code>), the wire gets a
        schema on both ends: mount and <code>updateProps</code> payloads are
        validated against <code>props</code> before they reach the app, and
        every declared <code>emit</code> is checked worker-side against{' '}
        <code>events</code> before it goes on the wire. Undeclared or
        malformed data fails fast in the worker instead of surfacing as a
        shell-side mystery.
      </p>
      <blockquote>
        <p>
          Deep internals — per-instance state, instance-scoped document
          resolution, the
          event-name bridge — live in the repo's{' '}
          <code>docs/islands.md</code>. This page is the consumer-facing
          model; that doc is the invariant list.
        </p>
      </blockquote>
    </article>
  );
}
