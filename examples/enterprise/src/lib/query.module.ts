/**
 * "Library as a module" — the same pattern RouterModule.forRoot uses: any
 * object with `__module` metadata can sit in `imports`, so third-party
 * config becomes injectable without a decorator.
 *
 *   @Module({ imports: [QueryModule.forRoot()] })
 *   // then anywhere: private q = inject(QueryClient)
 */
import { QueryClient, type QueryClientConfig } from '@tanstack/query-core';
import { syncQueryClient } from './broadcast-query';

export class QueryModule {
  static forRoot(config: QueryClientConfig = {}) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, ...config.defaultOptions?.queries },
        ...config.defaultOptions,
      },
      ...config,
    });
    // Key-scoped BroadcastChannel sync: only SHARED_QUERY_KEYS cross
    // contexts — the dashboard's metrics/revenue/activity stay shell-local
    // and page-worker queries never land in the shell's heap.
    syncQueryClient(client);
    return {
      __module: {
        providers: [{ provide: QueryClient, useValue: client }],
      },
    };
  }
}
