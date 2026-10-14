import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Controllers() {
  return (
    <article>
      <h1>Controllers</h1>
      <p class="lead">
        Controllers own interaction state — form fields, selections, draft
        values, actions — so views stay declarative. They're plain injectable
        classes; where you declare one decides who shares the instance.
      </p>

      <h2>MVC in practice</h2>
      <CodeBlock
        file="users.controller.ts"
        code={`import { Controller, inject, signal } from '@solid-mvc/core';
import { UsersApi } from './users.api';

@Controller()
export class UsersController {
  private api = inject(UsersApi);

  search = signal('');
  selected = signal<Set<number>>(new Set());

  // Debounce lives in the controller — the view just binds.
  private timer?: ReturnType<typeof setTimeout>;
  setSearch(v: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.search.value = v), 250);
  }

  toggle(id: number) {
    const next = new Set(this.selected.value);
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.value = next;
  }

  onDestroy() { clearTimeout(this.timer); }
}`}
      />
      <CodeBlock
        file="users.view.tsx"
        language="tsx"
        code={`@Component({ controllers: [UsersController] })
export class UsersView extends View {
  private c = inject(UsersController);

  render() {
    return (
      <input
        placeholder="Search…"
        onInput={(e) => this.c.setSearch(e.currentTarget.value)}
      />
      // …
    );
  }
}`}
      />

      <h2>The scope matrix</h2>
      <p>
        Declaring a controller registers it in that injector — resolution
        checks explicit registrations up the whole ancestor chain first, and
        only falls back to a fresh transient instance when nothing is
        declared:
      </p>
      <table class="doc-table">
        <thead>
          <tr><th>Where declared</th><th>Who shares the instance</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Nowhere — just <code>inject(C)</code></td>
            <td>Transient: one per injecting scope</td>
          </tr>
          <tr>
            <td><code>@Component(&#123; controllers &#125;)</code></td>
            <td>That view's whole subtree — parent and nested child views get the same instance</td>
          </tr>
          <tr>
            <td><code>@Module(&#123; controllers &#125;)</code></td>
            <td>Every view in the module's scope — a module-wide session controller</td>
          </tr>
        </tbody>
      </table>
      <p>
        This makes <em>where</em> you declare semantically meaningful: a form
        controller declared on the form view is shared with the field
        components inside it; declared on the module it becomes feature-wide
        state.
      </p>

      <h2>useController — the escape hatch</h2>
      <p>
        Inside a function component (or when you explicitly want a fresh
        per-mount controller regardless of declarations),{' '}
        <code>useController(C)</code> creates an instance scoped to that
        component mount and runs its lifecycle with it:
      </p>
      <CodeBlock
        language="tsx"
        code={`function TagEditor() {
  // Fresh controller per mounted TagEditor — onInit/onDestroy run with it.
  const c = useController(TagEditorController);
  return <input value={c.draft.value} onInput={...} />;
}`}
      />
      <p>
        More on the helpers in{' '}
        <a href={docHref('context')}>Context &amp; helpers</a>.
      </p>
    </article>
  );
}
