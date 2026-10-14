/**
 * Ticker island contract — the one module BOTH sides import. It names the
 * registry app, declares the emit payload shape (validated worker-side),
 * and carries the worker factory, so the shell mounts
 * `islandComponent(tickerContract)` with no worker plumbing at all.
 *
 * Never import the `.worker.tsx` entry itself here: defining a worker
 * installs instance globals. The URL literal inside `new Worker(...)`
 * stays bundler-detectable — do not hoist or compute it.
 */
import { defineIslandContract, z } from '@solid-mvc/atoll-island';

export const tickerContract = defineIslandContract({
  app: 'ticker',
  events: {
    'worker-ping': z.object({ requests: z.number() }),
  },
  worker: () =>
    new Worker(new URL('../workers/ticker.worker.tsx', import.meta.url), {
      type: 'module',
    }),
});
