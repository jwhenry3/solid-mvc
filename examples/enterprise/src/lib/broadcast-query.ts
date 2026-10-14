/**
 * Cross-thread query cache sync, KEY-SCOPED. TanStack's v4
 * broadcastQueryClient plugin was removed in v5 (persist-client-core
 * takes a generic AsyncStorage, not a channel), so this recreates the
 * same idea by hand — but syncs only the keys each context declares:
 *
 * - PUBLISH: on a cache event, only the changed query is dehydrated
 *   (delta, not the whole cache), and only when its key matches `keys`.
 * - ACCEPT: incoming state is filtered to the same `keys` before
 *   hydrate(), so a context never materializes a cache it doesn't read.
 *
 * BroadcastChannel natively spans the main thread and workers on one
 * origin, so no island plumbing is needed for the cache.
 *
 * The `hydrating` flag breaks the echo loop: hydrate() fires cache
 * events, which the subscriber would otherwise rebroadcast forever.
 * BroadcastChannel never delivers a message to its sender, so the flag
 * is only needed on the receive path.
 *
 * Call once per QueryClient (shell AND worker). Returns teardown.
 */
import {
  QueryClient,
  dehydrate,
  hydrate,
  partialMatchKey,
  type DehydratedState,
  type QueryKey,
} from '@tanstack/query-core';

/**
 * The shared vocabulary: query-key prefixes worth crossing thread
 * boundaries. A query matches when its key STARTS WITH one of these.
 * Everything else stays local to its context — no copy, no wire traffic.
 *
 * `['users']` matches `['users']`, `['users', 'ada']`, `['users', { q }]`…
 */
export const SHARED_QUERY_KEYS: QueryKey[] = [['users'], ['metrics']];

const shares = (queryKey: QueryKey, keys: QueryKey[]): boolean =>
  keys.some((k) => partialMatchKey(queryKey, k));

export interface SyncOptions {
  /** Prefixes this context publishes AND accepts. Default SHARED_QUERY_KEYS;
   *  pass [] to opt a context out entirely. */
  keys?: QueryKey[];
  channelName?: string;
}

let seq = 0;

export function syncQueryClient(
  client: QueryClient,
  { keys = SHARED_QUERY_KEYS, channelName = 'enterprise-query-sync' }: SyncOptions = {},
): () => void {
  const origin = `ctx-${Date.now()}-${seq++}`;
  const channel = new BroadcastChannel(channelName);
  let hydrating = false;

  channel.onmessage = (e: MessageEvent) => {
    const msg = e.data as { origin?: string; type?: string; state?: DehydratedState };
    if (msg?.type !== 'query-cache' || msg.origin === origin || !msg.state) return;
    const state = {
      ...msg.state,
      queries: msg.state.queries.filter((q) => shares(q.queryKey, keys)),
    };
    if (!state.queries.length) return;
    hydrating = true;
    try {
      hydrate(client, state);
    } finally {
      hydrating = false;
    }
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (hydrating) return;
    if (event.type !== 'updated' && event.type !== 'added' && event.type !== 'removed') {
      return;
    }
    const query = 'query' in event ? event.query : undefined;
    if (!query || !shares(query.queryKey, keys)) return;
    // Delta broadcast: dehydrate ONLY the query that changed.
    const state = dehydrate(client, {
      shouldDehydrateQuery: (q) => q === query,
    });
    if (state.queries.length) {
      channel.postMessage({ type: 'query-cache', origin, state });
    }
  });

  return () => {
    unsubscribe();
    channel.close();
  };
}
