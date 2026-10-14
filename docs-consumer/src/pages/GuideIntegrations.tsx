import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function GuideIntegrations() {
  return (
    <article>
      <h1>Integrating libraries</h1>
      <p class="lead">
        The framework's answer to "how do I use library X" is almost always
        the same two moves: provide the client object through DI, and bridge
        its subscribe API into a signal. No adapter packages needed.
      </p>

      <h2>Move 1: the client is a provider</h2>
      <p>
        Any library with a client/store/registry object becomes a module
        provider — usually via a small <code>forRoot</code> module so config
        travels with it:
      </p>
      <CodeBlock
        file="query.module.ts"
        code={`import { QueryClient, type QueryClientConfig } from '@tanstack/query-core';

// Same pattern as RouterModule.forRoot: an object carrying __module
// metadata can sit in 'imports' — no decorator needed.
export class QueryModule {
  static forRoot(config: QueryClientConfig = {}) {
    const client = new QueryClient(config);
    return {
      __module: {
        providers: [{ provide: QueryClient, useValue: client }],
      },
    };
  }
}

// app.module.ts
@Module({ imports: [QueryModule.forRoot()] })
export class AppModule {}`}
      />
      <p>
        Views resolve it with <code>inject(QueryClient)</code> — the class
        itself is the token (an <code>InjectionToken</code> is only needed
        for non-class values or aliases). Testing swaps one provider.
      </p>

      <h2>Move 2: subscribe → signal</h2>
      <p>
        Most libraries expose <code>subscribe(fn) → unsubscribe</code>{' '}
        somewhere. Bridge that into a signal and every view reading it gets
        fine-grained reactivity; dispose through the calling scope's{' '}
        <code>DestroyRef</code> and cleanup is automatic:
      </p>
      <CodeBlock
        file="query.ts"
        code={`import { signal, getCurrentInjector, DestroyRef } from '@solid-mvc/core';
import { QueryObserver, type QueryObserverOptions } from '@tanstack/query-core';

// Call inside construction — the scope's DestroyRef owns the observer.
export function querySignal<T>(
  client: QueryClient,
  opts: QueryObserverOptions<T> | (() => QueryObserverOptions<T>),
) {
  const getOpts = typeof opts === 'function' ? opts : () => opts;
  const observer = new QueryObserver(client, getOpts());
  const s = signal(observer.getCurrentResult());
  const unsub = observer.subscribe((r) => (s.value = r));
  getCurrentInjector()?.get(DestroyRef).onDestroy(unsub);
  // Options getter → tracked effect re-keys the same observer on signal
  // writes (reactive query keys, zero leaked subscriptions).
  if (typeof opts === 'function') effect(() => observer.setOptions(getOpts()));
  return s;
}`}
      />
      <blockquote>
        <p>
          This is the general recipe: <em>construct the library object,
          subscribe into a signal, hand teardown to DestroyRef</em>. The same
          shape wraps WebSockets, RxJS <code>Observable</code>s, Firebase
          listeners, media queries — anything with a callback.
        </p>
      </blockquote>

      <h2>Move 3 (rare): lifecycle-bound wrappers</h2>
      <p>
        Libraries that need a DOM element — ECharts, maps, editors — can't be
        injectables (no element at construction). The pattern is a tiny
        function component that owns both the element ref and the instance:
      </p>
      <CodeBlock
        file="chart.tsx"
        language="tsx"
        code={`import { createEffect, onCleanup } from 'solid-js';
import * as echarts from 'echarts';

export function Chart(props: { option: echarts.EChartsOption }) {
  let el!: HTMLDivElement;
  const chart = () => echarts.getInstanceByDom(el)!;
  createEffect(() => {
    if (!chart()) echarts.init(el);
    chart().setOption(props.option);      // tracked — re-applies on change
  });
  onCleanup(() => chart()?.dispose());    // element-bound cleanup
  return <div ref={el} style="width:100%;height:100%" />;
}`}
      />
      <p>
        Rules of thumb: <strong>stateful client?</strong> provider.{' '}
        <strong>Push API?</strong> signal bridge.{' '}
        <strong>DOM-bound?</strong> component wrapper. For worked examples,
        see <a href={docHref('guide-query')}>data fetching</a> and the{' '}
        <a href={docHref('demo-enterprise')}>enterprise demo</a>.
      </p>
    </article>
  );
}
