#!/usr/bin/env node
/**
 * smvc — the SolidMVC CLI. Angular-CLI-shaped: new / generate /
 * serve / build / test / add / update / version / docs.
 *
 * Dependency-free on purpose: the CLI must run before a project has
 * node_modules, and it ships runnable .mjs (other @solid-mvc packages
 * ship ./src/*.ts for bundler resolution — a bin needs JS).
 */
import { execSync } from 'node:child_process';
import { args, cliVersion, findProjectRoot, frameworkDeps, log } from './lib.mjs';
import { cmdNew } from './commands/new.mjs';
import { cmdGenerate } from './commands/generate.mjs';
import { cmdBuild, cmdServe, cmdTest } from './commands/run.mjs';
import { cmdAdd, cmdUpdate } from './commands/update.mjs';
const HELP = `pmvc — the SolidMVC CLI

Usage: smvc <command> [args] [flags]

Project creation
  new <dir>                 Scaffold a new application
    --islands                 include a worker-island demo (contract + worker + route)
    --tailwind                wire Tailwind v4 (deps + vite plugin + styles)
    --skip-install            don't npm install
    --skip-tests              don't emit the sample test
    -d, --dry-run             print what would be created
    --force                   overwrite existing files

Generators
  g|generate <kind> <name>  Scaffold into an existing project (run inside one)
    view|component            src/app/<name>/<name>.view.tsx (+ .test.tsx)
    controller                <name>.controller.ts — @Controller view logic
    service                   <name>.service.ts — @Injectable model/service
    module                    <name>.module.ts — feature module
    island                    islands/<name>.contract.ts + workers/<name>.worker.tsx
    --path <dir>              override the target directory
    --skip-tests / -d / --force

Build & dev (delegates to the project's vite/vitest)
  serve|dev [vite args]     Dev server
  build [vite args]         tsc --noEmit + vite build (--no-typecheck to skip)
  test [vitest args]        vitest run (--watch for watch mode)

Maintenance
  add <recipe>              Install + wire an integration: tailwind | islands
  update                    Bump @solid-mvc/* deps to latest (or --to <ver>)
    --include-atoll           also bump @atolljs/* deps
    -d / --skip-install

Other
  version|v|(--version|-v)  CLI + detected project versions
  docs [--open]             Where the docs live
  help|(--help|-h)          This message
`;

function cmdVersion() {
  log(`@solid-mvc/cli ${cliVersion()}`);
  const found = findProjectRoot();
  if (found) {
    const deps = { ...found.pkg.dependencies, ...found.pkg.devDependencies };
    for (const dep of frameworkDeps(found.pkg)) {
      log(`  ${dep}: ${deps[dep]}`);
    }
    if (deps['@atolljs/core']) log(`  @atolljs/core: ${deps['@atolljs/core']}`);
    if (deps['solid-js']) log(`  solid-js: ${deps['solid-js']}`);
    if (deps.vite) log(`  vite: ${deps.vite}`);
  }
}

function cmdDocs(a) {
  const url = 'https://github.com/jwhenry3/solid-mvc';
  if (a.open) {
    try {
      const opener =
        process.platform === 'win32'
          ? `start "" "${url}"`
          : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;
      execSync(opener, { stdio: 'ignore', shell: true });
      return;
    } catch {
      // fall through to printing
    }
  }
  log(`Docs site lives in this repo (docs-consumer/) — sources of truth:`);
  log(`  repo:      ${url}`);
  log(`  local:     npm run dev:docs  (in the framework checkout)`);
}

const COMMANDS = {
  new: cmdNew,
  g: cmdGenerate,
  generate: cmdGenerate,
  add: cmdAdd,
  update: cmdUpdate,
  docs: cmdDocs,
};

// serve/build/test pass ALL args through to vite/vitest — raw argv, not
// parsed flags (a `--port 3000` belongs to vite, not pmvc).
const RAW_COMMANDS = { serve: cmdServe, dev: cmdServe, build: cmdBuild, test: cmdTest };

const argv = process.argv.slice(2);
const cmd = argv[0];

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  process.stdout.write(HELP);
} else if (cmd === 'version' || cmd === 'v' || cmd === '--version' || cmd === '-v') {
  cmdVersion();
} else if (RAW_COMMANDS[cmd]) {
  RAW_COMMANDS[cmd](argv.slice(1));
} else if (COMMANDS[cmd]) {
  const a = args(argv.slice(1), { d: 'dry-run', h: 'help' });
  if (a.help) {
    process.stdout.write(HELP);
  } else {
    COMMANDS[cmd](a);
  }
} else {
  console.error(`Unknown command "${cmd}".\n`);
  process.stdout.write(HELP);
  process.exit(1);
}
