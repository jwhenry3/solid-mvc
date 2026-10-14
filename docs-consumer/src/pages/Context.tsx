import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Context() {
  return (
    <article>
      <h1>Context &amp; helpers</h1>
      <p class="lead">
        View classes inject at construction, but plain function components —
        reusable UI pieces, third-party wrappers — participate in the same
        injector tree through <code>InjectorContext</code> and three helpers.
      </p>

      <h2>The plumbing</h2>
      <p>
        The framework's host wraps every mounted view in{' '}
        <code>InjectorContext.Provider</code> with that view's injector.
        Function components read it with <code>useContext</code> under the
        hood — call them at component setup, not inside conditionals or
        callbacks:
      </p>
      <CodeBlock
        language="tsx"
        code={`import { useService, useController, useInjector, Provide } from '@solid-mvc/core';
import { ThemeService } from './theme.service';

function ThemeBadge() {
  const theme = useService(ThemeService);      // inject() for function components
  return <span class="badge">{theme.current.value}</span>;
}`}
      />

      <table class="doc-table">
        <thead>
          <tr><th>Helper</th><th>Returns</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>useInjector()</code></td>
            <td>The nearest enclosing <code>Injector</code></td>
          </tr>
          <tr>
            <td><code>useService(token)</code></td>
            <td><code>injector.get(token)</code> — same resolution as <code>inject()</code></td>
          </tr>
          <tr>
            <td><code>useController(Cls)</code></td>
            <td>A controller instance scoped to <em>this component mount</em>, with lifecycle — see below</td>
          </tr>
        </tbody>
      </table>

      <h2>useController vs inject()</h2>
      <p>
        <code>useController</code> deliberately bypasses the declared-scope
        lookup: it always creates a fresh controller owned by the component
        instance, calling its <code>onInit</code>/<code>onDestroy</code> with
        the mount. Use it when a reusable piece wants its own controller
        regardless of what ancestors declared:
      </p>
      <CodeBlock
        language="tsx"
        code={`function ColorPicker() {
  // Every mounted ColorPicker gets its own controller + lifecycle.
  const c = useController(ColorPickerController);
  return <input type="color" value={c.value.value}
                onInput={(e) => (c.value.value = e.currentTarget.value)} />;
}`}
      />

      <h2>&lt;Provide&gt; — ad-hoc scopes in JSX</h2>
      <p>
        <code>Provide</code> creates a child injector for its subtree —
        shadowing or adding providers without a module or component
        declaration:
      </p>
      <CodeBlock
        language="tsx"
        code={`function Sidebar() {
  return (
    <Provide providers={[SidebarStore, { provide: DENSE, useValue: true }]}>
      {/* children resolve SidebarStore + DENSE from this scope */}
      <NavList />
    </Provide>
  );
}`}
      />
      <p>
        Same hierarchy rules as everywhere: the <code>Provide</code> scope
        delegates upward, so children still see module and root services, and
        a local registration shadows an outer one for this subtree only.
      </p>

      <h2>When to use what</h2>
      <ul>
        <li>
          <strong>Feature building blocks</strong> — function components
          reading services: <code>useService</code>.
        </li>
        <li>
          <strong>Reusable interactive widget</strong> — fresh controller per
          mount: <code>useController</code>.
        </li>
        <li>
          <strong>Local override islands</strong> — a themed region, an
          embedded sub-tool: <code>&lt;Provide&gt;</code>.
        </li>
        <li>
          <strong>Everything else</strong> — views with real dependency
          graphs: class views + <code>inject()</code>. See{' '}
          <a href={docHref('views')}>Views</a>.
        </li>
      </ul>
    </article>
  );
}
