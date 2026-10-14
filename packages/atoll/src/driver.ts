/**
 * `@solid-mvc/atoll` shell surface — a thin facade over `@atolljs/islands`
 * (docs/atoll/islands.md). The op protocol, proxy DOM, instance lifecycle,
 * and op-replay driver are the real package now; this file only normalizes
 * the worker option (an already-created WorkerLike counts as an entry, the
 * real package wants a bundler-detectable factory or URL) and defaults the
 * transport to message-only so mounts work without COOP/COEP headers —
 * GitHub Pages can't serve them.
 *
 * Push mode still works: pass `mode: 'push'` on a `worker:` mount (builds a
 * doorbell client) or `doorbell: true` on `connectIslandWorker`, and serve
 * Cross-Origin-Opener-Policy: same-origin + Cross-Origin-Embedder-Policy:
 * require-corp.
 */
import {
  callbackProp,
  connectIslandWorker as atollConnectIslandWorker,
  islandAppNameOf,
  mountIsland as atollMountIsland,
} from '@atolljs/islands';
import type {
  IslandClient,
  IslandHandle,
  IslandWorkerOptions,
  Mode,
  Op,
} from '@atolljs/islands';

export { callbackProp };
export type { IslandClient, IslandHandle, Mode, Op };

/**
 * What a `worker:` option accepts: a bundler-detectable factory
 * `() => new Worker(new URL(...))`, a URL, or an already-spawned worker
 * (test doubles like `InProcessWorker` count — the real `Worker` type would
 * reject them, so the surface is structural).
 */
export type WorkerLike = Pick<
  Worker,
  'postMessage' | 'addEventListener' | 'removeEventListener' | 'terminate'
>;

const asWorkerEntry = (
  w: WorkerLike | (() => WorkerLike) | URL,
): (() => Worker) | URL =>
  w instanceof URL ? w : typeof w === 'function' ? (w as () => Worker) : () => w as Worker;

export interface ConnectOptions extends IslandWorkerOptions {
  /** Bundler-detectable factory / URL, or an already-spawned worker. */
  worker: WorkerLike | (() => WorkerLike) | URL;
  /**
   * Shared-memory doorbell for push-mode flush — requires cross-origin
   * isolation. Default false (message-only): mounts fall back to the 50ms
   * poll, which needs no special headers.
   */
  doorbell?: boolean;
  /**
   * Keep the worker thread resident (but idle) when its last island
   * destroys: the instance still unmounts — dispose hooks run, ops stop —
   * but the thread's module graph and worker-side caches survive, so the
   * next mount on this client is a warm start. Explicit `client.terminate()`
   * still kills it.
   */
  keepAlive?: boolean;
}

/** One island client = one dedicated worker. Islands mounted with `client:`
 *  share it; each `worker:` mount builds its own. */
export function connectIslandWorker({
  worker,
  doorbell = false,
  ...options
}: ConnectOptions): IslandClient {
  return atollConnectIslandWorker({ ...options, doorbell, worker: asWorkerEntry(worker) });
}

export interface MountOptions extends IslandWorkerOptions {
  /** Container the island's ops replay into. */
  el: HTMLElement;
  /**
   * Which app to mount: the `apps` registry key, a stamped app
   * (`islandApp`/`viewIsland` result), or a contract. Resolved through
   * `islandAppNameOf` — bare components fall back to the function name.
   */
  app?: unknown;
  props?: Record<string, unknown>;
  /** Island → shell channel: receives every worker-side `emit(name, payload)`. */
  onEvent?: (name: string, payload: unknown) => void;
  /** `data-atoll-slot` transclusion holes — shell mounts real DOM inside. */
  slots?: Record<string, (el: HTMLElement | null) => void>;
  onActivity?: () => void;
  onOps?: (ops: readonly Op[], elapsedMs: number) => void;
  /**
   * 'push' uses the doorbell SAB (cross-origin isolation required for
   * `worker:` mounts); 'poll' (the default here) needs none.
   */
  mode?: Mode;
  /** Devtools renderer tag ('solid-mvc'); the adapter sets it. */
  framework?: string;
  mountTimeout?: number;
  /** This mount's destroy() leaves the client resident-but-idle. */
  keepAlive?: boolean;
  /** A shared `connectIslandWorker` client, OR an entry this mount owns. */
  client?: IslandClient;
  worker?: WorkerLike | (() => WorkerLike) | URL;
}

export function mountIsland(opts: MountOptions): Promise<IslandHandle> {
  const { worker, client, app, mode = 'poll', ...rest } = opts;
  const name = islandAppNameOf(app);
  if (app !== undefined && name === undefined) {
    return Promise.reject(
      new Error(
        'mountIsland: could not resolve an app name — pass the registry key ' +
          'or stamp the app with islandApp(name, app)',
      ),
    );
  }
  const base = { ...rest, app: name, mode };
  return client !== undefined
    ? atollMountIsland({ ...base, client })
    : atollMountIsland({ ...base, worker: asWorkerEntry(worker!) });
}
