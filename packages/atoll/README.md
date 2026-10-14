# @solid-mvc/atoll

[![CI](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jwhenry3/solid-mvc/graph/badge.svg?branch=main)](https://codecov.io/gh/jwhenry3/solid-mvc)
[![Socket Badge](https://badge.socket.dev/npm/package/@solid-mvc/atoll)](https://badge.socket.dev/npm/package/@solid-mvc/atoll)

Framework-free worker-rendered islands, modeled on
[Atoll](https://jwhenry3.github.io/atolljs/): a facade over
`@atolljs/islands` + `@atolljs/core` that mounts a worker-hosted UI tree
as an ordinary element. The worker renders against a proxy DOM; commits
stream back over `postMessage` as ops the main-thread driver replays as
real DOM. Nothing in this package knows about the framework — that's what
`@solid-mvc/atoll-island` adds.

**[SolidMVC — islands documentation](https://jwhenry3.github.io/solid-mvc/docs/islands/)**

## Install

```bash
npm install @solid-mvc/atoll
```

## The contract is the shared module

`defineIslandContract` names the registry app, declares emit payloads
(validated worker-side with zod), and carries the worker factory — the
one file both threads import:

```ts
// ticker.contract.ts
import { defineIslandContract, z } from '@solid-mvc/atoll';

export const tickerContract = defineIslandContract({
  app: 'ticker',
  events: {
    'worker-ping': z.object({ count: z.number() }),
  },
  // The URL literal stays bundler-detectable — never hoist or compute it.
  worker: () =>
    new Worker(new URL('./ticker.worker.ts', import.meta.url), {
      type: 'module',
    }),
});
```

## Shell side

```ts
import { mountIsland, connectIslandWorker, callbackProp } from '@solid-mvc/atoll';
```

- `mountIsland` — mount a registered worker app into a host element.
- `connectIslandWorker` — drive an already-running worker.
- `callbackProp` — mark a prop as a function that crosses the wire.
- `islandApp`, `defineIslandContract`, `isIslandContract`, `z` — the
  registry/contract API re-exported from `@atolljs/islands` +
  `@atolljs/core`.
- `@solid-mvc/atoll/worker` — the worker-side entry (proxy DOM,
  instance dispatcher); import it only in worker code.

Rules of the wire: props and event payloads must be `structuredClone`-able;
functions cross only via `callbackProp` markers; worker code sees the
proxy DOM and nothing else — `document` resolves through the instance
dispatcher, never ambient globals.

Published builds ship compiled `dist/` (`.js` + `.d.ts`).
