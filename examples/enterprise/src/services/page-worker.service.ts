import { Injectable, inject, DestroyRef } from '@solid-mvc/core';
import { connectIslandWorker, type IslandClient } from '@solid-mvc/atoll-island';

/**
 * The worker host for worker-rendered routed pages (dashboard, users,
 * settings, components): one dedicated worker + client PER PAGE.
 * `clientFor(app)` lazily connects the page's worker on first navigation
 * and keeps it alive for the session — the page's worker-side caches
 * survive route swaps, and a heavy page can't stall a sibling's renders
 * because they live on separate threads. Every client terminates with the
 * app scope.
 *
 * Every client connects with `keepAlive`: navigating away unmounts the
 * page instance (lifecycle stops — timers, observers, ops all go down)
 * but the worker thread stays resident and idle, so navigating back is a
 * warm start on a live thread with its module graph and QueryClient
 * already loaded — no respawn, no re-init. The clients double as lazy
 * loaders: a page's bundle only evaluates when its worker first spawns,
 * and its data caches stay warm for the session. All threads still die
 * with the app scope via the DestroyRef teardown below.
 *
 * The dashboard worker hosts the whole page; its chart and ticker islands
 * spawn nested sub-workers from inside it (chart.worker, ticker.worker).
 *
 * The URL literals inside new Worker(...) stay bundler-detectable — do
 * not hoist or compute them.
 */
@Injectable()
export class PageWorkerHost {
  private destroyRef = inject(DestroyRef);

  private readonly factories: Record<string, () => Worker> = {
    dashboard: () =>
      new Worker(new URL('../workers/dashboard.worker.tsx', import.meta.url), {
        type: 'module',
      }),
    users: () =>
      new Worker(new URL('../workers/users.worker.tsx', import.meta.url), {
        type: 'module',
      }),
    settings: () =>
      new Worker(new URL('../workers/settings.worker.tsx', import.meta.url), {
        type: 'module',
      }),
    components: () =>
      new Worker(new URL('../workers/components.worker.tsx', import.meta.url), {
        type: 'module',
      }),
  };

  private readonly clients = new Map<string, IslandClient>();

  clientFor(app: string): IslandClient {
    let client = this.clients.get(app);
    if (!client) {
      const factory = this.factories[app];
      if (!factory) throw new Error(`PageWorkerHost: no worker for app "${app}"`);
      client = connectIslandWorker({ worker: factory, keepAlive: true });
      this.clients.set(app, client);
    }
    return client;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const client of this.clients.values()) client.terminate();
      this.clients.clear();
    });
  }
}
