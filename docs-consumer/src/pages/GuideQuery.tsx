import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function GuideQuery() {
  return (
    <article>
      <h1>Data fetching</h1>
      <p class="lead">
        Server state is a library concern, not a framework concern:
        TanStack Query does caching, deduping, and invalidation — the
        framework provides the client through DI and bridges results into
        signals.
      </p>

      <p>
        This page documents the pattern the{' '}
        <a href={docHref('demo-enterprise')}>enterprise example</a> ships —
        the snippets are its real files (<code>src/lib/query.module.ts</code>,{' '}
        <code>src/lib/query.ts</code>, <code>src/pages/users.view.tsx</code>),
        trimmed for width.
      </p>

      <h2>Provide the QueryClient</h2>
      <CodeBlock
        file="lib/query.module.ts"
        code={`import { QueryClient, type QueryClientConfig } from '@tanstack/query-core';

// "Library as a module" — the same pattern RouterModule.forRoot uses:
// an object with __module metadata can sit in 'imports'.
export class QueryModule {
  static forRoot(config: QueryClientConfig = {}) {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      ...config,
    });
    return {
      __module: {
        providers: [{ provide: QueryClient, useValue: client }],
      },
    };
  }
}`}
      />

      <h2>Bridge QueryObserver into a signal</h2>
      <p>
        <code>QueryObserver</code> is TanStack's headless core — no framework
        binding required, which is exactly what class views want:
      </p>
      <CodeBlock
        file="lib/query.ts"
        code={`import { signal, type Signal, effect,
         getCurrentInjector, DestroyRef } from '@solid-mvc/core';
import { QueryObserver, type QueryObserverOptions,
         type QueryObserverResult } from '@tanstack/query-core';

export function querySignal<TData, TError = Error>(
  client: QueryClient,
  options: QueryObserverOptions<TData, TError>
         | (() => QueryObserverOptions<TData, TError>),
): Signal<QueryObserverResult<TData, TError>> {
  const getOpts = typeof options === 'function' ? options : () => options;
  const observer = new QueryObserver(client, getOpts());
  const s = signal(observer.getCurrentResult());
  const unsubscribe = observer.subscribe((r) => (s.value = r));
  getCurrentInjector()?.get(DestroyRef).onDestroy(unsubscribe);
  if (typeof options === 'function') {
    effect(() => observer.setOptions(getOpts()));  // reactive keys
  }
  return s;
}`}
      />

      <h2>Consume in a view</h2>
      <CodeBlock
        file="pages/users.view.tsx"
        language="tsx"
        code={`@Component()
export class UsersView extends View {
  private api = inject(FakeApi);
  private qc = inject(QueryClient);
  private search = signal('');

  // Options GETTER → a scope-bound effect re-keys the observer when the
  // debounced search signal changes. One observer, correct cleanup.
  private users = querySignal(this.qc, () => ({
    queryKey: ['users', this.search.value],
    queryFn: () => this.api.users(this.search.value),
  }));

  render() {
    // Reads stay inside JSX — the tracked spots update on every
    // observer push; the render body itself runs once.
    return (
      <Show when={!this.users.value.isPending} fallback={<Skeleton />}>
        <Table>
          <For each={this.users.value.data ?? []}>
            {(u) => <TableRow>…</TableRow>}
          </For>
        </Table>
      </Show>
    );
  }
}`}
      />
      <p>
        The result is a signal — JSX reads of <code>isPending</code>,{' '}
        <code>isError</code>, <code>data</code> update the DOM as they
        change. Keys, caching, <code>invalidateQueries</code>, refetch,
        mutations — all standard TanStack semantics; the framework only owns
        the subscription boundary.
      </p>

      <h2>Why the options getter matters</h2>
      <p>
        Static options give you a fixed query. A getter runs inside a
        scope-bound <code>effect</code>: every signal it reads re-runs the
        effect on write, calling <code>observer.setOptions</code> — which
        re-keys the query through TanStack's cache (dedupe + refetch handled
        upstream). The debounced-search → new-key → filtered-rows chain in
        the demo is exactly this.
      </p>
      <p>
        The lifecycle side is the other half: subscriptions registered on
        the view's <code>DestroyRef</code> die with the view — navigate away
        and the observer unsubscribes. See{' '}
        <a href={docHref('guide-integrations')}>Integrating libraries</a> for
        the general recipe.
      </p>
    </article>
  );
}
