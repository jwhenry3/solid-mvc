import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Signals() {
  return (
    <article>
      <h1>Signals &amp; effects</h1>
      <p class="lead">
        Reactivity is Solid's signal graph underneath, wrapped so that
        effects created inside an injection scope are disposed with it — the
        piece that makes service-level <code>effect()</code> safe. The API
        keeps <code>.value</code> reads/writes over Solid primitives.
      </p>

      <h2>The primitives</h2>
      <CodeBlock
        code={`import { signal, computed, effect, batch, untracked } from '@solid-mvc/core';

const count = signal(0);
const doubled = computed(() => count.value * 2);

count.value++;            // write → subscribers recompute
doubled.value;            // 2 — computed lazily, cached

batch(() => {             // one notification for many writes
  firstName.value = 'Ada';
  lastName.value = 'Lovelace';
});

untracked(() => state.value);  // read without subscribing`}
      />

      <h2>Where they live</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Signal lives on</th><th>Pattern</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Service (<code>@Injectable</code>)</td>
            <td>Domain state — shared by every consumer of the scope</td>
          </tr>
          <tr>
            <td>Controller (<code>@Controller</code>)</td>
            <td>Interaction state — drafts, selections, UI toggles</td>
          </tr>
          <tr>
            <td>View (<code>View</code> fields)</td>
            <td>Local display state — expanded, hovered, editing</td>
          </tr>
        </tbody>
      </table>

      <h2>effect() is scope-aware</h2>
      <p>
        Calling <code>effect(fn)</code> during construction — inside an
        injectable, controller, or view — binds it to that scope's{' '}
        <code>DestroyRef</code>: it stops when the scope deactivates. No
        manual unsubscribe, no leaks across navigation:
      </p>
      <CodeBlock
        file="theme.service.ts"
        code={`@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<Theme>(readStored());

  constructor() {
    // Persists on every change; auto-disposed if the scope dies.
    effect(() => {
      localStorage.setItem('theme', this.theme.value);
      document.documentElement.classList.toggle('dark', this.isDark());
    });
  }
}`}
      />
      <p>
        Outside an injection context, <code>effect()</code> behaves like the
        upstream primitive — it runs until you call the returned dispose
        function.
      </p>

      <h2>Views subscribe inside JSX expressions</h2>
      <p>
        A view's <code>render()</code> runs <strong>once</strong> — Solid's
        model. Tracking happens where the JSX compiler wraps expressions in
        computations: a signal read inside a JSX expression, attribute, or{' '}
        <code>&lt;For&gt;</code>/<code>&lt;Show&gt;</code> updates exactly the
        DOM that read it on write — no re-render, no vdom diff. A signal read
        eagerly in the <code>render()</code> body (e.g. into a local
        variable) is a snapshot and stays stale — move it inside the JSX.
      </p>
      <p>
        Reads in event handlers and timers don't subscribe (they're outside
        any computation), so you never hit the read-during-handler
        subscription traps hooks create — timers can safely write signals and
        the tracked DOM updates itself.
      </p>
      <blockquote>
        <p>
          The same view classes render inside worker islands — signals work
          identically on the worker thread, and each re-render serializes to
          ops the shell replays. See{' '}
          <a href={docHref('islands')}>Islands</a>.
        </p>
      </blockquote>
    </article>
  );
}
