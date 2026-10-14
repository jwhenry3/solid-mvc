/**
 * The worker entry — a bundler-detectable script (spawned via
 * `new Worker(new URL('./demo.worker.ts', import.meta.url))` in the view).
 * One PolyWorker registry, several island apps; every worker spawned from
 * this script can render any of them.
 */
import { defineViewPolyWorker } from '@solid-mvc/atoll-island/worker';
import { ClockIsland, CounterIsland } from './island-apps.island';

export const worker = defineViewPolyWorker({
  apps: {
    counter: CounterIsland,
    clock: ClockIsland,
  },
});
