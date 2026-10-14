import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function RouterPage() {
  return (
    <article>
      <h1>Router</h1>
      <p class="lead">
        <code>RouterModule.forRoot(routes)</code> provides a signal-backed{' '}
        <code>Router</code>: the matched route is a computed, so outlets and
        active-link styling re-render on navigation for free.
      </p>

      <h2>Setup</h2>
      <CodeBlock
        file="app.routes.ts"
        code={`import type { Route } from '@solid-mvc/core';
import { TodoModule } from './todos/todo.module';
import { HomeView } from './home.view';
import { UserView } from './user.view';
import { NotFoundView } from './not-found.view';

export const routes: Route[] = [
  { path: '/', component: HomeView },
  { path: '/todos', module: TodoModule },        // renders its bootstrap view inside TodoModule's injector
  { path: '/user/:name', component: UserView },  // :param segments capture + decode
  { path: '*', component: NotFoundView },        // wildcard fallback
];`}
      />
      <CodeBlock
        file="app.module.ts"
        code={`@Module({
  imports: [RouterModule.forRoot(routes)],
  bootstrap: [AppShell],
})
export class AppModule {}`}
      />

      <h2>Outlet and links</h2>
      <CodeBlock
        file="app.shell.tsx"
        language="tsx"
        code={`@Component()
export class AppShell extends View {
  private router = inject(Router);

  render() {
    return (
      <div class="shell">
        <nav>
          <Link to="/" class={this.router.isActive('/') ? 'active' : ''}>Home</Link>
          <Link to="/todos">Todos</Link>
        </nav>
        <main>
          <RouterOutlet />
        </main>
      </div>
    );
  }
}`}
      />
      <p>
        <code>&lt;Link&gt;</code> renders a real anchor (base-prefixed href —
        middle-click works) and intercepts plain clicks for SPA navigation.{' '}
        <code>Router.navigate(to)</code> does the same imperatively;
        <code>popstate</code> is wired for back/forward.
      </p>

      <h2>Params</h2>
      <CodeBlock
        language="tsx"
        code={`@Component()
export class UserView extends View {
  private router = inject(Router);
  render() {
    // params is a computed — updates if the route rematches.
    return <p>Hello, {this.router.params.value.name}</p>;
  }
}`}
      />

      <h2>Module routes = scoped injectors</h2>
      <p>
        A route with <code>module</code> mounts that module's bootstrap view
        inside the <em>module's own injector</em> (cached per parent — the
        same injector serves repeat visits). Feature services scoped to the
        module persist while you navigate inside it and are disposed when the
        injector is released.
      </p>

      <h2>Nested routes</h2>
      <p>
        <code>children</code> match by prefix: the URL resolves as a chain
        outermost → innermost, and each <code>&lt;RouterOutlet/&gt;</code>{' '}
        renders one level by depth — a routed view can host its own outlet
        and stay mounted while children swap underneath it.
      </p>
      <CodeBlock
        file="app.routes.ts"
        code={`export const routes: Route[] = [
  {
    path: '/settings',
    component: SettingsShell,        // stays mounted — renders <RouterOutlet/>
    children: [
      { path: 'general', component: GeneralView },   // /settings/general
      { path: 'security', component: SecurityView }, // /settings/security
    ],
  },
];`}
      />
      <CodeBlock
        file="settings.shell.tsx"
        language="tsx"
        code={`@Component()
export class SettingsShell extends View {
  render() {
    return (
      <section>
        <h2>Settings</h2>
        <nav>
          <Link to="/settings/general">General</Link>
          <Link to="/settings/security">Security</Link>
        </nav>
        {/* depth-1 outlet: renders whichever child matched */}
        <RouterOutlet />
      </section>
    );
  }
}`}
      />
      <p>
        <code>router.matches</code> exposes the whole chain;{' '}
        <code>router.params</code> merges params from every level (inner
        wins on collisions), so a child sees its parent's params too. A
        child with <code>module</code> nests its injector under the level
        that mounted it. A parent with children still matches when the URL
        ends at it (<code>/settings</code> renders the shell alone); static
        children outrank <code>:param</code> siblings by config order.
      </p>

      <h2>The router owns navigation</h2>
      <p>
        Under the hood the tree is <code>@solidjs/router</code> — the
        framework service stays the surface: <code>navigate()</code>
        delegates to its navigator and settles on the transition lane (url,
        history, and outlet land asynchronously), <code>popstate</code>{' '}
        restores back/forward, and a document-level interceptor claims
        same-origin <code>&lt;a href="/…"&gt;</code> clicks so plain
        anchors route without a <code>Link</code>. All listeners live on
        the router's injector scope — destroying the scope detaches them.
      </p>

      <h2>Mounted apps: basePath</h2>
      <p>
        The router derives its mount prefix from{' '}
        <code>document.baseURI</code> at construction — an app served from{' '}
        <code>/docs/demo/</code> automatically matches routes against the
        in-app path (<code>/users</code>, not{' '}
        <code>/docs/demo/users</code>) and prefixes it back onto{' '}
        <code>Link</code> hrefs and <code>navigate()</code>. No config needed
        for subpath hosting; override explicitly for edge cases:
      </p>
      <CodeBlock
        code={`RouterModule.forRoot(routes, { basePath: '/app/' })  // Angular's APP_BASE_HREF`}
      />
      <table class="doc-table">
        <thead>
          <tr><th>API</th><th>With base <code>/demo</code></th></tr>
        </thead>
        <tbody>
          <tr><td><code>router.url.value</code></td><td><code>'/users'</code> — always the in-app path</td></tr>
          <tr><td><code>router.href('/users')</code></td><td><code>'/demo/users'</code> — what anchors emit</td></tr>
          <tr><td><code>router.navigate('/users')</code></td><td>pushState → <code>'/demo/users'</code></td></tr>
          <tr><td><code>ROUTER_BASE</code> token</td><td>Inject the configured base string anywhere</td></tr>
        </tbody>
      </table>
      <blockquote>
        <p>
          History routing still needs a host that serves the app shell for
          unknown paths — or per-route files. See{' '}
          <a href={docHref('hosting')}>Hosting &amp; Pages</a> for the
          trade-offs on static hosts.
        </p>
      </blockquote>
    </article>
  );
}
