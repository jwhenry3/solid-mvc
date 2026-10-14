import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Overview() {
  return (
    <article>
      <h1>SolidMVC</h1>
      <p class="lead">
        A frontend framework that takes Angular's architecture and renders it
        with React's ergonomics: modules, dependency injection, and decorators
        around class-based JSX views on Solid, with signal reactivity and
        worker-rendered islands built in.
      </p>

      <h2>The idea</h2>
      <p>
        Angular got application <em>shape</em> right — modules that own
        providers, injectors that scope services, decorators that declare
        intent, an MVC split between views and controllers. React got{' '}
        <em>rendering</em> right — components are values, JSX composes freely,
        and imports resolve identity instead of a template registry. SolidMVC
        keeps both: you write JSX with ordinary imports, and organize it with
        modules and DI.
      </p>
      <CodeBlock
        file="counter.view.tsx"
        language="tsx"
        code={`import { Component, Controller, View, inject, signal } from '@solid-mvc/core';

@Controller()
class CounterController {
  count = signal(0);
  inc = () => this.count.value++;
}

// A view is a class. Injection happens once at mount — no hooks in render().
@Component({ controllers: [CounterController] })
export class CounterView extends View {
  private c = inject(CounterController);
  render() {
    return <button onClick={this.c.inc}>count: {this.c.count.value}</button>;
  }
}`}
      />

      <h2>Three packages</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>What it is</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>@solid-mvc/core</code></td>
            <td>
              The framework: injector, decorators (<code>@Module</code>,{' '}
              <code>@Component</code>, <code>@Injectable</code>,{' '}
              <code>@Controller</code>), <code>View</code> classes, signals,
              context, router. One dependency: <code>solid-js</code>.
            </td>
          </tr>
          <tr>
            <td><code>@solid-mvc/atoll</code></td>
            <td>
              Facade over <code>@atolljs/islands</code> +{' '}
              <code>@atolljs/core</code>: the op protocol, the proxy DOM a
              worker renders into, the worker runtime, the island contracts,
              and the main-thread driver that replays ops onto real DOM.
            </td>
          </tr>
          <tr>
            <td><code>@solid-mvc/atoll-island</code></td>
            <td>
              The binding package: <code>&lt;Island/&gt;</code> shell
              components on the main thread,{' '}
              <code>defineViewPolyWorker</code>/<code>viewIslandApp</code> on
              the worker side. The same View classes render in both places.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>What it borrows from each side</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>From Angular</th>
            <th>From Solid</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Modules that own providers and declare components</td>
            <td>Components are values you import, not registered selectors</td>
          </tr>
          <tr>
            <td>Hierarchical injectors, provider scopes, <code>inject()</code></td>
            <td>JSX everywhere — no template language, no compile step</td>
          </tr>
          <tr>
            <td>Decorators for metadata (<code>@Module</code>, <code>@Component</code>)</td>
            <td>Freedom of composition — undeclared views mount anywhere</td>
          </tr>
          <tr>
            <td>MVC split: controllers own interaction state</td>
            <td>Signals for fine-grained reactivity</td>
          </tr>
          <tr>
            <td>Standalone components (<code>@Component imports</code>)</td>
            <td>Class construction replaces per-render hook calls</td>
          </tr>
        </tbody>
      </table>

      <h2>The whole Solid ecosystem, unchanged</h2>
      <p>
        <code>render()</code> returns ordinary Solid JSX — anything that
        works in a Solid app works here, no "framework bindings" version of
        the library:
      </p>
      <ul>
        <li>
          <strong>Any Solid component</strong> — icon sets, UI kits, form
          controls — drops straight into a view's JSX. Control flow stays
          idiomatic: <code>&lt;For&gt;</code>, <code>&lt;Show&gt;</code>,
          context, portals.
        </li>
        <li>
          <strong>Fine-grained by construction</strong> — the framework's
          signals wrap Solid's own reactive graph, so reads inside JSX
          update exactly the DOM that read them — no re-render, no diff.
        </li>
        <li>
          <strong>Anything else</strong> is two moves: provide the client
          object through DI, bridge its <code>subscribe</code> into a signal.
          DOM-bound libraries (charts, editors, maps) get a three-line
          ref wrapper — see{' '}
          <a href={docHref('guide-integrations')}>Integrating libraries</a>.
        </li>
      </ul>
      <p>
        The enterprise demo proves it in practice: TanStack Query Core,
        ECharts, zod, date-fns, lucide-solid icons, and a Tailwind/shadcn
        component layer all run through those moves. Inside worker islands
        the same View classes render too — even ECharts runs there,
        emitting SVG through the proxy DOM.
      </p>

      <h2>And one thing neither has</h2>
      <p>
        <strong>Worker-rendered islands.</strong> A{' '}
        <code>&lt;Island app="ticker" worker={'{...}'} /&gt;</code> mounts a
        real SolidMVC view tree inside a Web Worker — the same View classes,
        signals, and DI — while the shell sees an ordinary element that ticks,
        emits events, and never blocks the main thread. See{' '}
        <a href={docHref('islands')}>Islands</a>.
      </p>

      <h2>Where to go next</h2>
      <ul>
        <li><a href={docHref('quickstart')}>Quickstart</a> — first app in ten minutes</li>
        <li><a href={docHref('di')}>Dependency injection</a> — the scoping model everything builds on</li>
        <li><a href={docHref('views')}>Views & lifecycle</a> — class-based components</li>
        <li><a href={docHref('islands')}>Islands</a> — worker-rendered UI</li>
        <li><a href={docHref('demo-app')}>Live demos</a> — running apps embedded in this site</li>
      </ul>
    </article>
  );
}
