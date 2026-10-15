/**
 * `smvc new <dir>` — scaffold a SolidMVC application, the `ng new`
 * equivalent. Flags: --islands, --tailwind, --skip-install,
 * --skip-tests, -d/--dry-run, --force (overwrite existing files).
 */
import { resolve } from 'node:path';
import {
  VERSIONS,
  frameworkRange,
  render,
  run,
  toKebab,
  writeFile,
  fail,
  log,
} from '../lib.mjs';
import * as T from '../templates.mjs';

export function cmdNew(argv) {
  const a = argv; // pre-parsed by cli.mjs
  const dir = a._[0];
  if (!dir) fail('usage: smvc new <directory> [--islands] [--tailwind] [--skip-install]');
  const name = toKebab(dir.split(/[\\/]/).pop());
  const root = resolve(dir);
  const opts = {
    dry: !!a['dry-run'],
    force: !!a.force,
  };
  const islands = !!a.islands;
  const tailwind = !!a.tailwind;
  const skipTests = !!a['skip-tests'];

  const fw = frameworkRange();
  const dependencies = {
    '@solid-mvc/core': fw,
    'solid-js': VERSIONS['solid-js'],
  };
  const devDependencies = {
    'vite-plugin-solid': VERSIONS['vite-plugin-solid'],
    '@babel/core': VERSIONS['@babel/core'],
    '@babel/plugin-proposal-decorators': VERSIONS['@babel/plugin-proposal-decorators'],
    '@babel/plugin-transform-class-properties':
      VERSIONS['@babel/plugin-transform-class-properties'],
    '@solidjs/testing-library': VERSIONS['@solidjs/testing-library'],
    '@types/node': VERSIONS['@types/node'],
    jsdom: VERSIONS.jsdom,
    typescript: VERSIONS.typescript,
    vite: VERSIONS.vite,
    vitest: VERSIONS.vitest,
  };
  if (islands) {
    dependencies['@solid-mvc/atoll'] = fw;
    dependencies['@solid-mvc/atoll-island'] = fw;
    dependencies['@atolljs/core'] = VERSIONS['@atolljs/core'];
  }
  if (tailwind) {
    devDependencies.tailwindcss = VERSIONS.tailwindcss;
    devDependencies['@tailwindcss/vite'] = VERSIONS['@tailwindcss/vite'];
  }

  const packageJson = JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview',
        test: 'vitest run',
        'test:watch': 'vitest',
        typecheck: 'tsc --noEmit',
      },
      dependencies,
      devDependencies,
    },
    null,
    2,
  );

  const tokens = {
    NAME: name,
    TITLE: name,
    TAILWIND_IMPORT: tailwind ? "import tailwindcss from '@tailwindcss/vite';\n" : '',
    TAILWIND_PLUGIN: tailwind ? 'tailwindcss(),' : '',
    ISLANDS_IMPORT: islands
      ? "import { TickerDemoView } from './island-demo/island-demo.view';\n"
      : '',
    ISLANDS_VITE_IMPORT: islands
      ? "import { WORKER_FILES, workerUniversalTag } from '@solid-mvc/atoll-island/vite';\n"
      : '',
    // In dev a worker entry arrives as a ?worker_file URL and its whole
    // import graph must compile universal — workerUniversalTag stamps
    // ?smvc-worker onto every reachable id, which WORKER_FILES matches.
    WORKER_FILES: islands
      ? ''
      : 'const WORKER_FILES = [/\\.worker\\.[tj]sx?/, /\\.island\\.[tj]sx?/];',
    ISLANDS_TAG: islands ? 'workerUniversalTag(),\n    ' : '',
    ISLANDS_ROUTE: islands ? "  { path: '/island', component: TickerDemoView },\n" : '',
    ISLANDS_NAV: islands ? "  { to: '/island', match: '/island', label: 'Island' },\n" : '',
    KEBAB: 'ticker',
    CAMEL: 'ticker',
    CLASS: 'Ticker',
  };

  const files = {
    'package.json': packageJson + '\n',
    'tsconfig.json': T.T_TSCONFIG,
    'vite.config.ts': render(T.T_VITE_CONFIG, tokens),
    'index.html': render(T.T_INDEX_HTML, tokens),
    '.gitignore': T.T_GITIGNORE,
    '.npmrc': T.T_NPMRC,
    'README.md': render(T.T_README, tokens),
    'src/main.tsx': T.T_MAIN,
    'src/styles.css': tailwind ? T.T_STYLES_TAILWIND : T.T_STYLES,
    'src/test-setup.ts': T.T_TEST_SETUP,
    'src/app/app.module.ts': render(T.T_APP_MODULE, tokens),
    'src/app/app.shell.tsx': render(T.T_APP_SHELL, tokens),
    'src/app/app.routes.ts': render(T.T_APP_ROUTES, tokens),
    'src/app/core/tokens.ts': T.T_TOKENS,
    'src/app/hello/hello.view.tsx': T.T_HELLO_VIEW,
    'src/app/counter/counter.view.tsx': T.T_COUNTER_VIEW,
  };
  if (!skipTests) files['src/app/hello/hello.view.test.tsx'] = T.T_HELLO_TEST;
  if (islands) {
    files['src/islands/ticker.contract.ts'] = render(T.T_ISLAND_CONTRACT, tokens);
    files['src/workers/ticker.worker.tsx'] = render(T.T_ISLAND_WORKER, tokens);
    files['src/app/island-demo/island-demo.view.tsx'] = render(
      T.T_ISLAND_DEMO_VIEW,
      tokens,
    );
  }

  log(`\nScaffolding a SolidMVC app in ${root}\n`);
  for (const [rel, contents] of Object.entries(files)) {
    writeFile(root, rel, contents, opts);
  }

  if (!a['skip-install']) {
    log('\nInstalling dependencies…');
    const code = run('npm', ['install'], { cwd: root, dry: opts.dry });
    if (code !== 0) fail('npm install failed — run it manually in the new directory.');
  }

  log(`
Done. Next:

  cd ${dir}
  ${a['skip-install'] ? 'npm install\n  ' : ''}smvc serve       # start the dev server
  smvc g view my-page   # scaffold a new view
`);
}
