/**
 * `@solid-mvc/atoll-island` — the `*-island` package's shell surface
 * (docs/atoll/islands-frameworks.md): mount a worker-hosted island tree as
 * an ordinary element in a SolidMVC app. The worker-side renderer
 * (viewIslandApp, defineViewPolyWorker) lives in the `./worker` entry.
 *
 * The facade pattern: a contract module (`defineIslandContract`) names the
 * app, declares the wire schemas, and carries the worker factory — the
 * view imports the contract only and mounts `islandComponent(contract)`
 * with no worker plumbing at the call site.
 *
 * The driver/mount API is re-exported from `@solid-mvc/atoll` so shell
 * code only needs this one package.
 */
export { Island, islandComponent, lazyIsland } from './shell';
export type {
  IslandAppRef,
  IslandFacadeProps,
  IslandProps,
  IslandShellProps,
} from './shell';
export {
  callbackProp,
  connectIslandWorker,
  contractOf,
  contractWorkerOf,
  defineIslandContract,
  isIslandContract,
  islandApp,
  islandAppNameOf,
  mountIsland,
  withContract,
  z,
} from '@solid-mvc/atoll';
export type {
  ConnectOptions,
  IslandAppProps,
  IslandClient,
  IslandContract,
  IslandContractEventHandler,
  IslandContractEvents,
  IslandContractProps,
  IslandHandle,
  IslandWorkerOptions,
  Mode,
  MountOptions,
  Schema,
  WorkerLike,
} from '@solid-mvc/atoll';
