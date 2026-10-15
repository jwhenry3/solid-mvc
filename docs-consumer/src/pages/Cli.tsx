import { CodeBlock } from '../components/CodeBlock';
import { docHref } from '../link';

export function Cli() {
  return (
    <article>
      <h1>CLI</h1>
      <p class="lead">
        <code>@solid-mvc/cli</code> is the project toolkit — Angular CLI
        shaped: scaffold apps, generate views/controllers/services/
        modules/islands, run the project's vite and vitest, add
        integrations, and bump framework deps.
      </p>

      <h2>Install</h2>
      <CodeBlock
        language="bash"
        code={`npm install -g @solid-mvc/cli
# or run without installing:
npx @solid-mvc/cli <command>`}
      />
      <p>
        The binary is <code>smvc</code> (with <code>solid-mvc</code> as a
        longer alias). It is dependency-free Node — it must run before a
        project has <code>node_modules</code> at all.
      </p>

      <h2>New application</h2>
      <CodeBlock
        language="bash"
        code={`smvc new my-app                  # core app: module + router + two views + a test
smvc new my-app --islands      # + worker-island demo (contract, worker, route)
smvc new my-app --tailwind     # + Tailwind v4 wired into vite and styles
smvc new my-app --skip-install # write files only`}
      />
      <p>
        The scaffold is the same shape this site documents:{' '}
        <code>AppModule</code> with <code>RouterModule.forRoot</code>, an{' '}
        <code>AppShell</code> view, a standalone <code>HelloView</code>, a
        stateful <code>CounterView</code>, jsdom test stubs, and the
        decorators-friendly <code>tsconfig</code>. Existing files are never
        overwritten unless <code>--force</code>; <code>-d/--dry-run</code>{' '}
        prints the plan without writing.
      </p>

      <h2>Generators</h2>
      <CodeBlock
        language="bash"
        code={`smvc g view user-card        # src/app/user-card/user-card.view.tsx (+ .test.tsx)
smvc g controller checkout   # checkout.controller.ts — @Controller view logic
smvc g service session       # session.service.ts — @Injectable model
smvc g module admin          # admin.module.ts — feature module
smvc g island ticker         # islands/ticker.contract.ts + workers/ticker.worker.tsx

smvc g view report --path src/app/admin   # override the target directory
smvc g view report --skip-tests           # no spec file`}
      />
      <p>
        Generators print the next step — the route entry or declaration to
        add — rather than editing files in place. The island generator emits
        the contract-first shape (worker factory inside the contract,{' '}
        <code>islandComponent</code> on the shell); run{' '}
        <code>smvc add islands</code> first if the atoll packages are not
        installed.
      </p>

      <h2>Serve, build, test</h2>
      <p>
        Thin pass-throughs to the project's own toolchain — every flag after
        the command goes to vite/vitest:
      </p>
      <CodeBlock
        language="bash"
        code={`smvc serve --port 3000      # vite dev server
smvc build                  # tsc --noEmit && vite build (--no-typecheck to skip)
smvc test                   # vitest run
smvc test --watch           # vitest watch mode`}
      />

      <h2>Integrations</h2>
      <CodeBlock
        language="bash"
        code={`smvc add tailwind   # deps + vite plugin + styles.css
smvc add islands    # @solid-mvc/atoll + atoll-island + @atolljs/core`}
      />

      <h2>Updates</h2>
      <CodeBlock
        language="bash"
        code={`smvc update                 # bump every @solid-mvc/* dep to latest, npm install
smvc update --to 0.2.0      # pin to a specific release
smvc update -d              # show the planned changes only
smvc update --include-atoll # also bump @atolljs/* deps`}
      />
      <p>
        <code>smvc version</code> prints the CLI version plus the detected
        framework dep ranges of the project you're inside.
      </p>

      <blockquote>
        <p>
          Generated tests mount views through{' '}
          <code>InjectorContext.Provider</code> — a bare <code>render()</code>{' '}
          has no injector context, so <code>inject()</code> throws by design.
          The generated vite config aliases <code>solid-js</code> to its
          client build so the whole graph resolves one runtime realm —
          without it, the node condition picks the server build where
          effects never run.
        </p>
      </blockquote>
    </article>
  );
}
