import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Quickstart() {
  return (
    <article>
      <h1>Quickstart</h1>
      <p class="lead">
        A routed todo app: one module, one store, one controller, one view.
        Six files, and injection replaces prop drilling from the start.
      </p>

      <h2>1 · Install</h2>
      <CodeBlock
        language="bash"
        code={`npm install @solid-mvc/core solid-js
npm install -D vite-plugin-solid @babel/plugin-proposal-decorators @babel/plugin-transform-class-properties typescript vite`}
      />
      <p>
        Decorators need two tsconfig flags; JSX stays{' '}
        <code>preserve</code> so vite-plugin-solid compiles it:
      </p>
      <CodeBlock
        file="tsconfig.json"
        language="json"
        code={`{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}`}
      />
      <p>
        And vite-plugin-solid compiles JSX with{' '}
        <code>@solid-mvc/core/web</code> as the JSX runtime module — its{' '}
        <code>createComponent</code> is what turns View classes into host
        components:
      </p>
      <CodeBlock
        file="vite.config.ts"
        code={`import solidPlugin from 'vite-plugin-solid';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    solidPlugin({
      solid: { moduleName: '@solid-mvc/core/web' },
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
        ],
      },
    }),
  ],
});`}
      />
      <blockquote>
        <p>
          <code>useDefineForClassFields: false</code> matters:{' '}
          <code>inject()</code> field initializers must run inside the
          injection context the constructor opens — class-field semantics
          would evaluate them too early.
        </p>
      </blockquote>

      <h2>2 · A store</h2>
      <CodeBlock
        file="todo.store.ts"
        code={`import { Injectable, signal, computed } from '@solid-mvc/core';

export interface Todo { id: number; text: string; done: boolean }

@Injectable()
export class TodoStore {
  todos = signal<Todo[]>([]);
  remaining = computed(() => this.todos.value.filter(t => !t.done).length);

  add(text: string) {
    this.todos.value = [
      ...this.todos.value,
      { id: Date.now(), text, done: false },
    ];
  }
}`}
      />

      <h2>3 · A controller</h2>
      <CodeBlock
        file="todo.controller.ts"
        code={`import { Controller, inject, signal } from '@solid-mvc/core';
import { TodoStore } from './todo.store';

@Controller()
export class TodoController {
  private store = inject(TodoStore);
  draft = signal('');

  submit() {
    const text = this.draft.value.trim();
    if (text) this.store.add(text);
    this.draft.value = '';
  }
}`}
      />

      <h2>4 · A view</h2>
      <CodeBlock
        file="todo.view.tsx"
        language="tsx"
        code={`import { For } from 'solid-js';
import { Component, View, inject } from '@solid-mvc/core';
import { TodoController } from './todo.controller';
import { TodoStore } from './todo.store';

@Component({ controllers: [TodoController] })
export class TodoView extends View {
  private c = inject(TodoController);
  private store = inject(TodoStore);

  render() {
    return (
      <section>
        <h2>Todos ({this.store.remaining.value} left)</h2>
        <input
          value={this.c.draft.value}
          onInput={(e) => (this.c.draft.value = e.currentTarget.value)}
        />
        <button onClick={() => this.c.submit()}>add</button>
        <ul>
          <For each={this.store.todos.value}>{(t) => <li>{t.text}</li>}</For>
        </ul>
      </section>
    );
  }
}`}
      />

      <h2>5 · The module declares it all</h2>
      <CodeBlock
        file="todo.module.ts"
        code={`import { Module } from '@solid-mvc/core';
import { TodoStore } from './todo.store';
import { TodoView } from './todo.view';

@Module({
  providers: [TodoStore],
  components: [TodoView],
  bootstrap: [TodoView],
})
export class TodoModule {}`}
      />

      <h2>6 · Bootstrap</h2>
      <CodeBlock
        file="main.tsx"
        language="tsx"
        code={`import { bootstrap } from '@solid-mvc/core';
import { TodoModule } from './todo.module';

bootstrap(TodoModule, document.getElementById('app')!);`}
      />

      <h2>What just happened</h2>
      <ul>
        <li>
          <code>bootstrap</code> created the app injector from{' '}
          <code>TodoModule</code> and mounted its bootstrap view inside it.
          JSX compiled against <code>@solid-mvc/core/web</code> routes View
          classes through <code>createComponent</code> into host components —
          Solid never constructs them directly.
        </li>
        <li>
          The view's injector resolved <code>TodoStore</code> (declared on the
          module) and the declared <code>TodoController</code> — once, at
          mount. <code>render()</code> runs once; signal reads inside JSX
          expressions are what Solid tracks.
        </li>
      </ul>
      <p>
        Next: <a href={docHref('di')}>dependency injection</a> for provider
        forms and scopes, or <a href={docHref('router')}>the router</a> to add
        routes.
      </p>
    </article>
  );
}
