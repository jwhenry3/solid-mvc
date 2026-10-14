import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Modules() {
  return (
    <article>
      <h1>Modules</h1>
      <p class="lead">
        <code>@Module</code> groups providers, controllers, and declared
        components into a feature. The module's injector — and the transitive
        closure of its imports — is the scope everything inside it sees.
      </p>

      <CodeBlock
        file="todo.module.ts"
        code={`import { Module } from '@solid-mvc/core';
import { SharedModule } from '../shared/shared.module';
import { TodoStore } from './todo.store';
import { TodoController } from './todo.controller';
import { TodoView } from './todo.view';

@Module({
  imports: [SharedModule],        // its providers/components join our scope
  providers: [TodoStore],         // one TodoStore per TodoModule injector
  controllers: [TodoController],  // shared down the module's subtree
  components: [TodoView],         // declares scope ownership (see below)
  bootstrap: [TodoView],          // what a route renders for this module
})
export class TodoModule {}`}
      />

      <h2>What each field does</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Field</th><th>Effect</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>providers</code></td>
            <td>Registered in the module's injector — one instance per module scope, shared by everything mounted under it.</td>
          </tr>
          <tr>
            <td><code>imports</code></td>
            <td>
              The imported module's providers and declared components become
              visible in this scope. The closure is transitive: importing a
              module that imports <code>SharedModule</code> brings shared
              services along.
            </td>
          </tr>
          <tr>
            <td><code>controllers</code></td>
            <td>
              Registered in the module injector — the same controller instance
              serves every view in the module's subtree (see{' '}
              <a href={docHref('controllers')}>Controllers</a>).
            </td>
          </tr>
          <tr>
            <td><code>components</code></td>
            <td>
              Scope <em>ownership</em>, not a lookup table: a declared view may
              only mount inside this module's injector ancestry. Undeclared
              views mount anywhere. See below.
            </td>
          </tr>
          <tr>
            <td><code>bootstrap</code></td>
            <td>
              The view rendered when a route points at this module (
              <code>{`{ path: '/todos', module: TodoModule }`}</code>) or when
              it's the app root.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Module injectors are cached per parent</h2>
      <p>
        <code>getModuleInjector(Mod, parent)</code> creates the injector once
        per parent scope — two routes into the same module share one injector,
        so module-scoped services survive navigation inside the feature.
      </p>

      <h2>Declaration = scope ownership, not resolution</h2>
      <p>
        In JSX, <code>&lt;TodoView/&gt;</code> is already the class — there's
        no selector registry for a declaration to feed. So{' '}
        <code>components</code> answers a different question:{' '}
        <em>what scope does this view live in?</em>
      </p>
      <CodeBlock
        code={`// TodoView is declared by TodoModule. Mounting it outside that
// module's injector ancestry fails at mount — before construction:
//
//   TodoView is declared by TodoModule but mounted outside its
//   injector scope. Mount it under a route/module that includes
//   TodoModule.
//
// The view's error boundary catches it locally: the rest of the app
// keeps rendering, the failed subtree shows a retryable fallback.`}
        language="plaintext"
      />
      <p>
        Undeclared views are free agents — <code>&lt;HelloView/&gt;</code>{' '}
        works anywhere its imports resolve, Angular's standalone model before
        standalone existed. Declaring buys you the discipline: the framework
        guarantees the view's dependency graph is satisfiable{' '}
        <em>by construction</em>, and fails fast with a clear message when it
        isn't.
      </p>
      <blockquote>
        <p>
          <code>exports</code> exists in the metadata for forward-compat but
          is not yet enforced — any component in the import closure is
          mountable in scope.
        </p>
      </blockquote>

      <h2>A feature module under a route</h2>
      <CodeBlock
        file="app.routes.ts"
        code={`export const routes: Route[] = [
  { path: '/', component: HomeView },
  { path: '/todos', module: TodoModule },   // renders TodoView inside TodoModule's injector
  { path: '/user/:name', component: HelloView },
  { path: '*', component: NotFoundView },
];`}
      />
      <p>
        Module routes are how feature scoping composes with the router — see{' '}
        <a href={docHref('router')}>Router</a>.
      </p>
    </article>
  );
}
