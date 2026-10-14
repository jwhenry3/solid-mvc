# @solid-mvc/core

[![CI](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jwhenry3/solid-mvc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jwhenry3/solid-mvc/graph/badge.svg?branch=main)](https://codecov.io/gh/jwhenry3/solid-mvc)
[![Socket Badge](https://badge.socket.dev/npm/package/@solid-mvc/core)](https://badge.socket.dev/npm/package/@solid-mvc/core)

Angular-inspired architecture rendered by Solid: `@Module`/`@Component`
decorators, hierarchical dependency injection, class-based `View`
components, controllers, an injector-scoped router, and signal reactivity
over Solid's reactive graph — all over plain JSX, with no template
compiler.

**[SolidMVC — documentation](https://jwhenry3.github.io/solid-mvc/docs/overview/)**

## Install

```bash
npm install @solid-mvc/core solid-js
npm install -D vite-plugin-solid @babel/plugin-proposal-decorators @babel/plugin-transform-class-properties
```

Point JSX at Solid (`tsconfig.json`) and compile it through the
framework's runtime module (`vite.config.ts`):

```jsonc
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

```ts
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solidPlugin({
      // @solid-mvc/core/web is the JSX runtime: its createComponent is
      // what mounts View classes inside their injector scopes.
      solid: { moduleName: '@solid-mvc/core/web' },
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
        ],
      },
    }),
  ],
});
```

## A view is a class

`View` subclasses are constructed once per mount inside their own injector
scope — `inject()` works in field initializers and constructors, `render()`
runs once, and signal reads inside JSX expressions stay tracked:

```tsx
import { Component, View, inject, signal, computed } from '@solid-mvc/core';

@Component()
export class CounterView extends View {
  count = signal(0);
  doubled = computed(() => this.count.value * 2);

  render() {
    return (
      <section>
        <button onClick={() => (this.count.value -= 1)}>−</button>
        <span>{this.count.value}</span>
        <button onClick={() => (this.count.value += 1)}>+</button>
        <p>doubled: {this.doubled.value}</p>
      </section>
    );
  }
}
```

## Modules are the app map

```ts
import { Module, RouterModule } from '@solid-mvc/core';
import { AppShell } from './app.shell';
import { routes } from './app.routes';

@Module({
  imports: [RouterModule.forRoot(routes)],
  providers: [{ provide: API_URL, useValue: '/api' }],
  bootstrap: [AppShell],
})
export class AppModule {}
```

```ts
// main.tsx
import { bootstrap } from '@solid-mvc/core';
import { AppModule } from './app/app.module';

bootstrap(AppModule, document.getElementById('app')!);
```

`components`/`bootstrap` declarations are enforced ownership: a declared
view may only mount where its module's injector is an ancestor.
Undeclared views mount anywhere — structure is opt-in per declaration.

## DI, controllers, router

- `@Injectable`/`@Controller` classes resolve through the element-injector
  hierarchy — view providers → module providers → root, closest scope wins.
- `OnInit`/`OnDestroy` lifecycle plus `DestroyRef` make teardown
  declaration-driven instead of `useEffect` cleanup.
- `RouterModule.forRoot(routes)` + `<RouterOutlet/>` + `<Link/>` give you
  nested routes whose `module` boundaries get their own child injectors.

Published builds ship compiled `dist/` (`.js` + `.d.ts`).
