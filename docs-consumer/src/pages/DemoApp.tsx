import { DemoFrame } from '../components/DemoFrame';
import { docHref } from '../link';

export function DemoApp() {
  return (
    <article>
      <h1>Framework demo</h1>
      <p class="lead">
        The reference app from <code>src/app/</code> — every core concept
        running live: module-scoped stores, controllers, standalone views,
        route params, and three worker islands on one shared worker.
      </p>

      <DemoFrame id="demo" port={5173} name="src/app" />

      <h2>What to try</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Route</th><th>What it demonstrates</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>/todos</code></td>
            <td>
              <code>TodoModule</code>: module-scoped <code>TodoStore</code> +
              declared <code>TodoController</code>. Add todos, navigate away,
              come back — state survives because the module injector is
              cached.
            </td>
          </tr>
          <tr>
            <td><code>/counter</code></td>
            <td>
              A view that is its own controller — signals on the class,
              <code>onInit</code> incrementing a root-provided session
              service.
            </td>
          </tr>
          <tr>
            <td><code>/hello/:name</code></td>
            <td>
              A standalone view (no module) with{' '}
              <code>@Component(&#123; imports: [SharedModule] &#125;)</code> —
              route params plus module services without a feature module.
            </td>
          </tr>
          <tr>
            <td><code>/island</code></td>
            <td>
              Three islands on ONE shared worker client: counter (click →
              event → worker re-sync), clock (out-of-task pushes), a
              dynamically spawned fourth. The milestone emit lands in the
              shell's event log. See{' '}
              <a href={docHref('islands')}>Islands</a>.
            </td>
          </tr>
          <tr>
            <td><code>/raw-todos</code></td>
            <td>
              Deliberately broken: <code>TodoView</code> mounted outside{' '}
              <code>TodoModule</code>'s scope — the ownership check fails at
              mount and the error boundary catches it locally while the app
              stays alive.
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
