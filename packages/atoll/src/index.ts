/**
 * `@solid-mvc/atoll` — the shell-facing facade over the real Atoll
 * packages (`@atolljs/islands` + `@atolljs/core`). Worker islands render
 * inside Web Workers against a proxy DOM; commits stream back as ops the
 * driver replays onto real DOM.
 *
 * Shell side (this entry): `mountIsland`, `connectIslandWorker`,
 * `callbackProp`, `islandApp`. Worker side (import in worker entries):
 * the `./worker` subpath re-exports `@atolljs/islands/worker` —
 * `definePolyWorker`/`defineMonoWorker`, `emit`, instance scope. The
 * SolidMVC adapter and `<Island/>` shell components live in
 * `@solid-mvc/atoll-island`.
 */
export { islandApp, islandAppNameOf } from '@atolljs/islands';
export type { IslandAppProps } from '@atolljs/islands';
export {
  defineIslandContract,
  isIslandContract,
  withContract,
  contractOf,
  contractWorkerOf,
} from '@atolljs/islands';
export type {
  IslandContract,
  IslandContractEventHandler,
  IslandContractEvents,
  IslandContractProps,
  IslandWorkerOptions,
} from '@atolljs/islands';
export type { EventPayload, Op, WireProps } from '@atolljs/islands';
export { z } from '@atolljs/core';
export type { Schema } from '@atolljs/core';

export { mountIsland, connectIslandWorker, callbackProp } from './driver';
export type { ConnectOptions, MountOptions, WorkerLike } from './driver';
export type { IslandClient, IslandHandle, Mode } from './driver';
