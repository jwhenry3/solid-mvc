# @solid-mvc/cli

[![CI](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jwhenry3/solid-mvc/graph/badge.svg?branch=main)](https://codecov.io/gh/jwhenry3/solid-mvc)
[![Socket Badge](https://badge.socket.dev/npm/package/@solid-mvc/cli)](https://badge.socket.dev/npm/package/@solid-mvc/cli)

The `smvc` binary — scaffolding, generators, dev/build/test delegation,
and dependency maintenance for SolidMVC projects.

**[SolidMVC — CLI documentation](https://jwhenry3.github.io/solid-mvc/docs/cli/)**

## Install

```bash
npm install -g @solid-mvc/cli
```

## Create an app

```bash
pmvc new my-app            # scaffold + npm install
pmvc new my-app --islands  # + worker-island demo (contract + worker + route)
pmvc new my-app --tailwind # + Tailwind v4 wiring
cd my-app && smvc serve    # vite dev server
```

The generated app is a runnable `@Module`-/`@Component`-structured Solid
project with router, DI tokens, a sample view test, and (with `--islands`)
a shared island contract + worker entry.

## Generators — run inside a project

```bash
pmvc g view my-page        # src/app/my-page/my-page.view.tsx (+ test)
pmvc g controller orders   # <name>.controller.ts — @Controller view logic
pmvc g service auth        # <name>.service.ts — @Injectable service
pmvc g module admin        # feature module
pmvc g island ticker       # contract + worker entry pair
```

## Build, dev, test

`pmvc serve|dev`, `pmvc build` (`tsc --noEmit` + `vite build`), and
`pmvc test` (`vitest run`) delegate to the project's own toolchain —
vite args pass through (`--watch`, `--no-typecheck`).

## Maintenance

- `pmvc add tailwind | islands` — install + wire an integration into an
  existing project.
- `pmvc update` — bump `@solid-mvc/*` deps (`--to <ver>`,
  `--include-atoll` for `@atolljs/*`).

The package is plain `.mjs` — no build step, ships `src/` directly.
