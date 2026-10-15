/**
 * File templates for `smvc new` and `smvc generate`. Tokens use the
 * %%UPPER_SNAKE%% form — safe inside JSX braces. Every template is
 * plain text; render() substitutes tokens and fails on leftovers.
 */

/* ── smvc new ──────────────────────────────────────────────────────── */

export const T_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
`;

export const T_VITE_CONFIG = `/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
%%TAILWIND_IMPORT%%%%ISLANDS_VITE_IMPORT%%
// Worker-side island code compiles for the universal renderer (the
// atoll-island/worker runtime module); everything else compiles for the
// DOM with @solid-mvc/core/web as the JSX runtime — its createComponent
// is what mounts View classes from JSX.
%%WORKER_FILES%%

// Babel must transform decorators itself — vite-plugin-solid's pipeline
// bypasses esbuild. legacy + loose class properties reproduces
// tsconfig's experimentalDecorators semantics.
const BABEL = {
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
  ],
};

export default defineConfig({
  plugins: [
    %%ISLANDS_TAG%%solidPlugin({
      include: WORKER_FILES,
      solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' },
      babel: BABEL,
    }),
    solidPlugin({
      exclude: WORKER_FILES,
      solid: { moduleName: '@solid-mvc/core/web' },
      babel: BABEL,
    }),
    %%TAILWIND_PLUGIN%%],
  worker: {
    // Vite does NOT inherit config.plugins for worker bundles — without
    // this, island .tsx falls back to esbuild classic JSX (React.*). Every
    // module reachable from a worker entry renders into the proxy DOM, so
    // the whole bundle compiles universal — no file-glob split here.
    // format: 'es' keeps import.meta alive for nested worker entries.
    format: 'es',
    plugins: () => [
      solidPlugin({
        solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' },
        babel: BABEL,
      }),
    ],
  },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // ONE solid-js realm — the node/worker export conditions pick the
      // server build where effects never re-run, so pin the client build
      // for every importer.
      { find: /^solid-js$/, replacement: fileURLToPath(new URL('./node_modules/solid-js/dist/solid.js', import.meta.url)) },
      { find: /^solid-js\\/web$/, replacement: fileURLToPath(new URL('./node_modules/solid-js/web/dist/web.js', import.meta.url)) },
    ],
  },
  // Keep @solid-mvc/* out of dep prebundling: the vite transform must see
  // their sources so JSX compiles against the right runtime module and
  // everything stays in one module realm.
  optimizeDeps: {
    exclude: ['@solid-mvc/core', '@solid-mvc/atoll', '@solid-mvc/atoll-island'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    // @solid-mvc/* and @solidjs/testing-library import solid-js — if they
    // externalize to node they resolve the SERVER build (the node export
    // condition), a second dead realm where effects and cleanup never
    // run. Inline them so everything shares the aliased client build.
    server: {
      deps: {
        inline: [
          /@solid-mvc[/]/,
          '@solidjs/testing-library',
          'solid-js',
        ],
      },
    },
  },
});
`;

export const T_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>%%TITLE%%</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export const T_GITIGNORE = `node_modules
dist
dist-ssr
*.local
.DS_Store
`;

// Consumer-friendly subset of the repo's installable-project policy:
// no min-release-age — it would ETARGET whenever a dep release is
// younger than the window, which is a bad first-run failure mode.
export const T_NPMRC = `ignore-scripts=true
save-exact=true
`;

export const T_README = `# %%NAME%%

A [SolidMVC](https://github.com/jwhenry3/solid-mvc) application —
Angular-style modules, DI, and MVC on class-based JSX views rendered by
Solid, with signal reactivity.

\`\`\`bash
smvc serve      # dev server (vite)
smvc build      # production build
smvc test       # vitest
smvc g view my-page     # scaffold a view
smvc g module admin     # scaffold a feature module
\`\`\`
`;

export const T_MAIN = `import { bootstrap } from '@solid-mvc/core';
import { AppModule } from './app/app.module';
import './styles.css';

bootstrap(AppModule, document.getElementById('app')!);
`;

export const T_STYLES = `body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.nav-link {
  opacity: 0.7;
  color: inherit;
  text-decoration: none;
}
.nav-link.active {
  opacity: 1;
  font-weight: 600;
}
`;

export const T_STYLES_TAILWIND = `@import "tailwindcss";

.nav-link {
  opacity: 0.7;
  color: inherit;
  text-decoration: none;
}
.nav-link.active {
  opacity: 1;
  font-weight: 600;
}
`;

// jsdom test stubs — the same pattern the repo itself uses.
export const T_TEST_SETUP = `// Node 22+ exposes an experimental \`localStorage\` global that is
// undefined unless --localstorage-file is passed. It shadows jsdom's
// storage (window === globalThis in vitest's jsdom env), so redefine it
// with a minimal in-memory Storage implementation for tests.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: true,
});

// jsdom has no matchMedia — a fixed "light" stub suffices for tests.
if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
    configurable: true,
  });
}
`;

export const T_APP_MODULE = `import { Module, RouterModule } from '@solid-mvc/core';
import { AppShell } from './app.shell';
import { routes } from './app.routes';
import { APP_TITLE } from './core/tokens';

@Module({
  imports: [RouterModule.forRoot(routes)],
  providers: [{ provide: APP_TITLE, useValue: '%%TITLE%%' }],
  bootstrap: [AppShell],
})
export class AppModule {}
`;

export const T_TOKENS = `import { InjectionToken } from '@solid-mvc/core';

export const APP_TITLE = new InjectionToken<string>('app title');
`;

export const T_APP_SHELL = `import { For } from 'solid-js';
import { Component, View, inject, RouterOutlet, Link, Router } from '@solid-mvc/core';
import { APP_TITLE } from './core/tokens';

const NAV = [
  { to: '/hello/world', match: '/hello', label: 'Hello' },
  { to: '/counter', match: '/counter', label: 'Counter' },
%%ISLANDS_NAV%%];

@Component()
export class AppShell extends View {
  private router = inject(Router);
  private title = inject(APP_TITLE);

  render() {
    return (
      <div style="min-height:100vh;display:flex;flex-direction:column">
        <header style="display:flex;align-items:center;gap:1rem;padding:0 1.25rem;height:3.5rem;border-bottom:1px solid #e2e2e8">
          <strong>{this.title}</strong>
          <nav style="display:flex;gap:1rem">
            <For each={NAV}>
              {(n) => (
                <Link
                  to={n.to}
                  class={this.router.url.value.startsWith(n.match) ? 'nav-link active' : 'nav-link'}
                >
                  {n.label}
                </Link>
              )}
            </For>
          </nav>
        </header>
        <main style="flex:1;padding:1.5rem">
          <RouterOutlet />
        </main>
      </div>
    );
  }
}
`;

export const T_APP_ROUTES = `import type { Route } from '@solid-mvc/core';
import { HelloView } from './hello/hello.view';
import { CounterView } from './counter/counter.view';
%%ISLANDS_IMPORT%%
export const routes: Route[] = [
  { path: '/', component: HelloView },
  { path: '/hello/:name', component: HelloView },
  { path: '/counter', component: CounterView },
%%ISLANDS_ROUTE%%  { path: '*', component: () => 'Not found.' },
];
`;

export const T_HELLO_VIEW = `import { Component, View, inject, computed, Router } from '@solid-mvc/core';

// Standalone view: declared by no module, mounts by route. Route params
// arrive on the injected Router's params signal.
@Component()
export class HelloView extends View {
  private router = inject(Router);
  private name = computed(() => this.router.params.value.name ?? 'world');

  render() {
    return (
      <section>
        <h1>Hello, {this.name.value}!</h1>
        <p>
          Try <code>/hello/ada</code> — the name is a <code>:name</code> route param.
        </p>
      </section>
    );
  }
}
`;

export const T_HELLO_TEST = `import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { Injector, InjectorContext, Router } from '@solid-mvc/core';
import { routes } from '../app.routes';
import { HelloView } from './hello.view';

// Views mount inside an injector scope — stand in for bootstrap() with a
// bare injector providing whatever the view injects (HelloView needs the
// Router for its :name param).
function mount(node: () => JSX.Element, injector = new Injector()) {
  return render(() => (
    <InjectorContext.Provider value={injector}>
      {node()}
    </InjectorContext.Provider>
  ));
}

describe('HelloView', () => {
  it('renders a greeting', () => {
    const inj = new Injector();
    inj.provide({ provide: Router, useValue: new Router(routes) });
    const { container } = mount(() => <HelloView />, inj);
    expect(container.querySelector('h1')?.textContent).toContain('Hello');
  });
});
`;

export const T_COUNTER_VIEW = `import { Component, View, signal, computed } from '@solid-mvc/core';
import type { OnInit } from '@solid-mvc/core';

@Component()
export class CounterView extends View implements OnInit {
  count = signal(0);
  doubled = computed(() => this.count.value * 2);

  onInit() {}

  render() {
    return (
      <section>
        <h1>Counter</h1>
        <div style="display:flex;align-items:center;gap:1rem">
          <button onClick={() => (this.count.value -= 1)}>−</button>
          <span style="font-size:1.5rem;font-variant-numeric:tabular-nums">
            {this.count.value}
          </span>
          <button onClick={() => (this.count.value += 1)}>+</button>
        </div>
        <p>doubled: {this.doubled.value}</p>
      </section>
    );
  }
}
`;

/* ── smvc new --islands ────────────────────────────────────────────── */

export const T_ISLAND_CONTRACT = `/**
 * %%CLASS%% island contract — the one module BOTH sides import. It names
 * the registry app, declares the emit payload shape (validated
 * worker-side), and carries the worker factory, so the shell mounts
 * islandComponent(%%CAMEL%%Contract) with no worker plumbing.
 *
 * Never import the .worker.tsx entry here: defining a worker installs
 * instance globals. The URL literal inside new Worker(...) stays
 * bundler-detectable — do not hoist or compute it.
 */
import { defineIslandContract, z } from '@solid-mvc/atoll-island';

export const %%CAMEL%%Contract = defineIslandContract({
  app: '%%KEBAB%%',
  events: {
    'worker-ping': z.object({ count: z.number() }),
  },
  worker: () =>
    new Worker(new URL('../workers/%%KEBAB%%.worker.tsx', import.meta.url), {
      type: 'module',
    }),
});
`;

export const T_ISLAND_WORKER = `/**
 * Worker entry — bundler-detectable (spawned with the literal
 * new URL(..., import.meta.url) form in %%KEBAB%%.contract). Hosts the
 * island apps below; everything here runs inside the worker against the
 * proxy DOM, View classes and all.
 */
import { Component, View, signal } from '@solid-mvc/core';
import {
  defineViewPolyWorker,
  viewIslandApp,
  emit,
} from '@solid-mvc/atoll-island/worker';
import { %%CAMEL%%Contract } from '../islands/%%KEBAB%%.contract';

@Component()
export class %%CLASS%%Island extends View {
  private count = signal(0);
  private timer: ReturnType<typeof setInterval> | undefined;

  onInit() {
    // Out-of-task signal writes: each tick re-renders in the worker and
    // pushes an op batch — the shell never coordinates it.
    this.timer = setInterval(() => {
      this.count.value++;
      if (this.count.value % 10 === 0) emit('worker-ping', { count: this.count.value });
    }, 1000);
  }
  onDestroy() {
    clearInterval(this.timer);
  }

  render() {
    return (
      <div style="font-variant-numeric:tabular-nums">
        <strong>%%KEBAB%% island</strong> — worker uptime: {this.count.value}s
      </div>
    );
  }
}

export const worker = defineViewPolyWorker({
  apps: { '%%KEBAB%%': viewIslandApp(%%CLASS%%Island, { contract: %%CAMEL%%Contract }) },
});
`;

export const T_ISLAND_DEMO_VIEW = `import { Component, View } from '@solid-mvc/core';
import { islandComponent } from '@solid-mvc/atoll-island';
import { %%CAMEL%%Contract } from '../../islands/%%KEBAB%%.contract';

// The contract carries the worker factory — no worker plumbing here.
const %%CLASS%%Island = islandComponent(%%CAMEL%%Contract);

@Component()
export class %%CLASS%%DemoView extends View {
  render() {
    return (
      <section>
        <h1>Worker island</h1>
        <p>
          This box renders inside a Web Worker and emits typed events back
          to the shell.
        </p>
        <%%CLASS%%Island
          onEvent={(name, payload) => console.log('island event', name, payload)}
        />
      </section>
    );
  }
}
`;

/* ── smvc generate ─────────────────────────────────────────────────── */

export const G_VIEW = `import { Component, View, signal } from '@solid-mvc/core';
import type { OnInit, OnDestroy } from '@solid-mvc/core';

@Component()
export class %%CLASS%%View extends View implements OnInit, OnDestroy {
  // Signals drive updates — reads inside JSX expressions are tracked.
  private loading = signal(true);

  onInit() {
    this.loading.value = false;
  }

  onDestroy() {}

  render() {
    return (
      <section>
        <h1>%%TITLE%%</h1>
        {this.loading.value ? <p>Loading…</p> : <p>Ready.</p>}
      </section>
    );
  }
}
`;

export const G_VIEW_TEST = `import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { Injector, InjectorContext } from '@solid-mvc/core';
import { %%CLASS%%View } from './%%KEBAB%%.view';

// Views mount inside an injector scope — a bare Injector stands in for
// bootstrap(). provide() whatever the view injects.
function mount(node: () => JSX.Element, injector = new Injector()) {
  return render(() => (
    <InjectorContext.Provider value={injector}>
      {node()}
    </InjectorContext.Provider>
  ));
}

describe('%%CLASS%%View', () => {
  it('renders', () => {
    const { container } = mount(() => <%%CLASS%%View />);
    expect(container.querySelector('h1')?.textContent).toBe('%%TITLE%%');
  });
});
`;

export const G_CONTROLLER = `import { Controller } from '@solid-mvc/core';
import type { OnInit, OnDestroy } from '@solid-mvc/core';

// Injectable view logic. Declare it on a view (@Component({ controllers }))
// or module (@Module({ controllers })) to share one instance down that
// scope — injected undeclared, it is transient per injecting scope.
@Controller()
export class %%CLASS%%Controller implements OnInit, OnDestroy {
  onInit() {}

  onDestroy() {}
}
`;

export const G_SERVICE = `import { Injectable, inject, DestroyRef } from '@solid-mvc/core';

// Root-provided by default via @Injectable. inject() and scope-bound
// effects work in field initializers and the constructor.
@Injectable()
export class %%CLASS%%Service {
  private destroyRef = inject(DestroyRef);
}
`;

export const G_MODULE = `import { Module } from '@solid-mvc/core';

// Declare views under \`components\` so ownership is enforced, and view
// logic under \`controllers\` to share one instance across this scope.
@Module({
  providers: [],
  components: [],
  controllers: [],
})
export class %%CLASS%%Module {}
`;
