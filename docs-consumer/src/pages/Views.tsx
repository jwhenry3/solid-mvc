import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Views() {
  return (
    <article>
      <h1>Views &amp; lifecycle</h1>
      <p class="lead">
        A view is a class extending <code>View</code>, decorated with{' '}
        <code>@Component</code>, constructed once inside its own injector
        scope by the framework's createComponent seam — never by Solid directly.
      </p>

      <h2>Anatomy</h2>
      <CodeBlock
        file="profile.view.tsx"
        language="tsx"
        code={`import { Component, View, inject, signal } from '@solid-mvc/core';
import { UserService } from './user.service';

@Component()
export class ProfileView extends View<{ userId: string }> {
  // Construction runs inside this view's injector scope — inject() in field
  // initializers is the mount-time equivalent of constructor injection.
  private users = inject(UserService);
  private expanded = signal(false);

  // props arrive through the constructor: readable in field initializers.
  onInit() { console.log('mounted', this.props.userId); }
  onDestroy() { console.log('unmounted'); }

  render() {
    const user = this.users.byId(this.props.userId);
    return (
      <article onClick={() => (this.expanded.value = !this.expanded.value)}>
        <h3>{user.name}</h3>
        {this.expanded.value && <p>{user.bio}</p>}
      </article>
    );
  }
}`}
      />

      <h2>The rules</h2>
      <ul>
        <li>
          <strong>Views are classes, not hooks.</strong> JSX compiles
          against <code>@solid-mvc/core/web</code>, whose{' '}
          <code>createComponent</code> routes every JSX-referenced View
          subclass through <code>viewComponent()</code> — a host component
          that constructs the class inside a fresh injector scope. Solid
          never instantiates them itself; <code>render()</code> stays
          hook-free.
        </li>
        <li>
          <strong><code>inject()</code> belongs in field initializers or the
          constructor.</strong> That's when the injection context exists —
          the Angular "constructor injection" equivalent, without constructor
          boilerplate.
        </li>
        <li>
          <strong><code>render()</code> runs once; JSX tracks.</strong>{' '}
          Signal reads inside JSX expressions, attributes,{' '}
          <code>&lt;For&gt;</code>/<code>&lt;Show&gt;</code> update exactly
          the DOM that read them — no re-render, no deps arrays, no stale
          closures. Eager reads in the render body are snapshots.
        </li>
        <li>
          <strong>Props are construction-visible and reactive.</strong> The
          host assigns a getter-backed props object before the constructor
          finishes — field initializers read initial values, JSX reads stay
          live (<code>View&lt;Props&gt;</code> types them).
        </li>
      </ul>

      <h2>Lifecycle</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Hook</th><th>When</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>onInit()</code></td>
            <td>
              Scope activated — the view mounted and its injector resolved all
              managed services/controllers. Their <code>onInit</code>s fire
              here too.
            </td>
          </tr>
          <tr>
            <td><code>onDestroy()</code></td>
            <td>
              Scope deactivated — unmount. Fires on the view plus every
              service and controller created inside its scope.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Activation is synchronous with the host mount, so{' '}
        <code>onInit</code>/<code>onDestroy</code> always pair correctly —
        even for a view that mounts and unmounts within the same tick, like
        a fast redirect. <code>DestroyRef.onDestroy</code>{' '}
        callbacks run at the same moment for anything not implementing the
        interface.
      </p>

      <h2>The error boundary</h2>
      <p>
        Every view host is wrapped in a boundary. If construction or render
        throws — a missing provider, a scope-ownership violation, a render
        bug — the failed subtree renders a fallback box (with a Retry action
        that remounts the view) instead of crashing the whole app:
      </p>
      <CodeBlock
        language="plaintext"
        code={`┌─ something went wrong ──────────────────┐
│ No provider for TodoStore (looked up    │
│ from "root")                     [Retry] │
└──────────────────────────────────────────┘`}
      />

      <h2>View-scoped providers and controllers</h2>
      <p>
        <code>@Component(&#123; providers, controllers &#125;)</code> registers
        dependencies in the view's own injector — children see them, siblings
        don't. Details in{' '}
        <a href={docHref('metadata')}>Component metadata</a> and{' '}
        <a href={docHref('controllers')}>Controllers</a>.
      </p>
    </article>
  );
}
