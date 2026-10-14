/**
 * Worker-realm sub-island client cache.
 *
 * dashboard.view.tsx renders INSIDE the dashboard page worker, and the
 * module only exists in the worker realm — this Map survives an island
 * unmount/remount because the page worker stays resident via keepAlive.
 * Each contract-mounted facade (<Ticker>/<Chart>) would otherwise build a
 * fresh connectIslandWorker client per mount — and with keepAlive that
 * LEAKS: the old thread stays resident while the new client spawns
 * another. Sharing the client means unmount destroys the instance but
 * leaves the sub-worker resident-but-idle, so return navigation is a
 * warm start.
 *
 * IMPORTANT: only import this from worker-graph modules — in the shell
 * realm the cache would spawn workers the page never mounts.
 */
import {
  connectIslandWorker,
  contractWorkerOf,
  islandAppNameOf,
  type IslandClient,
  type IslandContract,
} from '@solid-mvc/atoll-island';

const clients = new Map<string, IslandClient>();

export function subWorkerClient(contract: IslandContract): IslandClient {
  const name = islandAppNameOf(contract) ?? 'main';
  let client = clients.get(name);
  if (client === undefined) {
    const worker = contractWorkerOf(contract);
    if (worker === undefined) {
      throw new Error(`subWorkerClient: contract "${name}" carries no worker factory`);
    }
    client = connectIslandWorker({ name, worker, keepAlive: true });
    clients.set(name, client);
  }
  return client;
}
