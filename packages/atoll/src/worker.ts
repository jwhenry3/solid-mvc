/**
 * `@solid-mvc/atoll/worker` — the worker-side entry, re-exported from
 * `@atolljs/islands/worker`. Import in worker entries only:
 *
 *   import { definePolyWorker } from '@solid-mvc/atoll/worker';
 *   export const worker = definePolyWorker({ apps: { ... } });
 */
export {
  definePolyWorker,
  defineMonoWorker,
  islandApp,
  islandAppNameOf,
  emit,
  runInInstance,
  getActiveInstance,
  getLastActiveInstance,
  getLastTouchedInstance,
  setActiveInstance,
  installDomShim,
  ProxyElement,
} from '@atolljs/islands/worker';
/**
 * Nested-island surfaces: `mountIsland` is the ONE mount API on both
 * threads — a ProxyElement target (inside a worker-rendered tree) routes
 * to the registered sub-mounter and spawns a real sub-worker; a real
 * element drives the main-thread applier. `connectIslandWorker` is
 * thread-agnostic and spawns from whichever thread calls it. Re-exported
 * through our driver facade so the same worker-option normalization and
 * message-only defaults apply on nested mounts. Platform note: nested
 * `new Worker` needs an engine that supports it — Chrome/Firefox/Node,
 * NOT Safari workers.
 */
export {
  connectIslandWorker,
  mountIsland,
  callbackProp,
} from './driver';
export type { ConnectIslandWorkerConfig, MountIslandOptions } from '@atolljs/islands/worker';
export {
  defineIslandContract,
  isIslandContract,
  withContract,
  contractOf,
} from '@atolljs/islands/worker';
export type {
  ImperativeIslandApp,
  IslandApp,
  IslandContract,
  PolyWorkerRegistry,
  ProxyDocument,
  RenderContext,
  RenderedHandle,
  RenderedIslandApp,
} from '@atolljs/islands/worker';
export type { EventPayload, Op, WireProps } from '@atolljs/islands/worker';
export type { IslandWorkerDefinition } from '@atolljs/islands';

import { setActiveInstance } from '@atolljs/islands/worker';
import type { IslandWorkerDefinition } from '@atolljs/islands';

/** What `definePolyWorker`/`defineMonoWorker` return — the worker def type
 *  island clients type-check against. */
export type IslandWorkerDef = IslandWorkerDefinition;

/**
 * Enter `key`'s instance scope, returning the previous key for restore —
 * a named pair around `setActiveInstance` (which returns the prev itself),
 * used by the SolidMVC adapter's out-of-task render scoping.
 */
export const enterInstance = (key: string): string => setActiveInstance(key);
/** Restore the scope `enterInstance` returned (`''` when there was none). */
export const exitInstance = (prev: string | null): void => {
  setActiveInstance(prev ?? '');
};
