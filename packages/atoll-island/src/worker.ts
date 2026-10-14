/**
 * `@solid-mvc/atoll-island/worker` — the `*-island` package's worker
 * renderer (docs/atoll/islands-frameworks.md): render View classes and
 * function components into the instance's proxy document via the Solid
 * universal renderer.
 *
 *   // render.worker.ts
 *   export const worker = defineViewPolyWorker({
 *     apps: { counter: CounterView, clock: ClockView },
 *   });
 *
 * This entry is also the JSX runtime module for `generate: 'universal'`
 * worker files: compiled output calls insert/spread/setProp/createComponent
 * from here (see docs/atoll/frameworks/solid.md). The framework-free
 * worker API is re-exported from `@solid-mvc/atoll/worker` so a worker
 * entry needs no direct atoll-core import.
 */
export {
  viewIslandApp,
  viewIsland,
  defineViewPolyWorker,
  defineViewMonoWorker,
} from './adapter';
export type { ViewIslandAppOptions, ViewPolyWorkerRegistry } from './adapter';

// The universal-renderer runtime surface — everything babel-preset-solid's
// `generate: 'universal'` output calls, plus `h` for hand-authoring. Core
// primitives (createSignal, createEffect, mapArray, createContext, ...)
// come straight from 'solid-js'.
export {
  render,
  h,
  insert,
  insertNode,
  spread,
  setProp,
  effect,
  memo,
  use,
  createComponent,
  mergeProps,
  createElement,
  createTextNode,
} from './renderer';

/**
 * The mount components on the worker side — same surface as the shell
 * entry (Atoll's `*-island/worker` convention): inside a worker-rendered
 * tree the component's div is a ProxyElement, `mountIsland` takes the
 * nested path, and the sub-island's ops tunnel up the parent instance's
 * op stream. `connectIslandWorker` builds a shared sub-worker client;
 * `emit` in a nested `onEvent` relays events to the page.
 */
export { Island, islandComponent, lazyIsland } from './shell';
export type {
  IslandProps,
  IslandShellProps,
  IslandAppRef,
  IslandFacadeProps,
} from './shell';
export { connectIslandWorker, mountIsland, callbackProp } from '@solid-mvc/atoll/worker';
export {
  contractOf,
  defineIslandContract,
  definePolyWorker,
  defineMonoWorker,
  emit,
  installDomShim,
  isIslandContract,
  runInInstance,
  enterInstance,
  exitInstance,
  getActiveInstance,
  getLastActiveInstance,
  islandApp,
  islandAppNameOf,
  withContract,
  ProxyElement,
} from '@solid-mvc/atoll/worker';
export type {
  EventPayload,
  ImperativeIslandApp,
  IslandContract,
  RenderedIslandApp,
  RenderContext,
  RenderedHandle,
  IslandApp,
  IslandWorkerDef,
  ProxyDocument,
} from '@solid-mvc/atoll/worker';
