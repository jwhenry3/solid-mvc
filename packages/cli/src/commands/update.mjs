/**
 * `pmvc update` — bump @solid-mvc/* dependencies, the `ng update`
 * equivalent. Flags: --to <version>, --include-atoll, -d/--dry-run,
 * --skip-install.
 *
 * `pmvc add <recipe>` — install + wire an integration, the `ng add`
 * equivalent. Recipes: tailwind, islands.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VERSIONS,
  frameworkDeps,
  frameworkRange,
  findProjectRoot,
  npmViewVersion,
  run,
  writeFile,
  fail,
  warn,
  log,
} from '../lib.mjs';
import * as T from '../templates.mjs';

function project() {
  const found = findProjectRoot();
  if (!found) fail('not inside a SolidMVC project (no @solid-mvc/core dependency found)');
  return found;
}

/* ── update ───────────────────────────────────────────────────────── */

// Future migrations: { to: 'x.y.z', run(root, pkg) {} }. When a release
// needs a code mod, append an entry here — `pmvc update` applies every
// migration whose `to` is newer than the dep's current range.
const MIGRATIONS = [];

export function cmdUpdate(a) {
  const { root, pkg } = project();
  const dry = !!a['dry-run'];
  const targets = new Set(frameworkDeps(pkg));
  if (a['include-atoll']) {
    for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (d.startsWith('@atolljs/')) targets.add(d);
    }
  }
  if (targets.size === 0) fail('no @solid-mvc/* dependencies in this project');

  const to = a.to === true ? null : a.to; // `--to v` or nothing
  const changes = [];
  for (const dep of targets) {
    const next = to ?? npmViewVersion(dep) ?? 'latest';
    for (const field of ['dependencies', 'devDependencies']) {
      const cur = pkg[field]?.[dep];
      if (!cur) continue;
      // Semver-ish targets get a caret; dist-tags like 'latest' pass bare.
      const range = /^[\d^~>=]/.test(next) ? `^${next.replace(/^[\^~]/, '')}` : next;
      if (cur !== range) changes.push({ field, dep, cur, range });
    }
  }

  if (changes.length === 0) {
    log('All @solid-mvc dependencies are already at the target version.');
    return;
  }
  log('');
  for (const c of changes) log(`  ${c.dep}: ${c.cur} → ${c.range}`);
  log('');

  if (!dry) {
    for (const c of changes) pkg[c.field][c.dep] = c.range;
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  }

  if (MIGRATIONS.length) {
    for (const m of MIGRATIONS) {
      log(`  migration → ${m.to}`);
      if (!dry) m.run(root, pkg);
    }
  }

  if (!a['skip-install']) {
    const code = run('npm', ['install'], { cwd: root, dry });
    if (code !== 0) fail('npm install failed — resolve and re-run, or use --skip-install.');
  }
  log('Update complete.');
}

/* ── add ──────────────────────────────────────────────────────────── */

function installDeps(root, deps, { dev = true, dry = false } = {}) {
  const args = ['install', ...(dev ? ['-D'] : [])];
  for (const [name, range] of Object.entries(deps)) args.push(`${name}@${range}`);
  const code = run('npm', args, { cwd: root, dry });
  if (code !== 0) fail('npm install failed');
}

/** Insert the tailwind plugin into a generated-shape vite.config. */
function patchViteConfig(root, dry) {
  const path = join(root, 'vite.config.ts');
  if (!existsSync(path)) {
    warn('no vite.config.ts — add `tailwindcss()` to your plugins manually');
    return;
  }
  let src = readFileSync(path, 'utf8');
  if (src.includes('@tailwindcss/vite')) {
    log('      SKIP     vite.config.ts (tailwindcss already configured)');
    return;
  }
  const next = src
    .replace(
      /(import solidPlugin from 'vite-plugin-solid';)/,
      `$1\nimport tailwindcss from '@tailwindcss/vite';`,
    )
    .replace(/(plugins:\s*\[[\s\S]*?)(\n\s*)\]/, '$1    tailwindcss(),$2]');
  if (next === src) {
    warn('vite.config.ts has an unrecognized shape — add `tailwindcss()` to plugins manually');
    return;
  }
  log(`      UPDATE   vite.config.ts`);
  if (!dry) writeFileSync(path, next);
}

/** Wire worker-island JSX plumbing into a generated-shape vite.config. */
function patchViteConfigIslands(root, dry) {
  const path = join(root, 'vite.config.ts');
  if (!existsSync(path)) {
    warn('no vite.config.ts — wire `workerUniversalTag()` + a `worker:` block manually');
    return;
  }
  let src = readFileSync(path, 'utf8');
  if (src.includes('workerUniversalTag')) {
    log('      SKIP     vite.config.ts (worker islands already configured)');
    return;
  }
  let next = src
    .replace(
      /(import solidPlugin from 'vite-plugin-solid';)/,
      `$1\nimport { WORKER_FILES, workerUniversalTag } from '@solid-mvc/atoll-island/vite';`,
    )
    .replace(/\nconst WORKER_FILES = [^\n]+;\n?/, '\n')
    .replace(/(plugins:\s*\[\s*)/, '$1workerUniversalTag(),\n    ');
  if (!/worker:\s*\{/.test(next)) {
    next = next.replace(
      /(export default defineConfig\(\{)/,
      `$1
  worker: {
    // Vite does NOT inherit config.plugins for worker bundles — island .tsx
    // would fall back to esbuild classic JSX without the plugin here.
    format: 'es',
    plugins: () => [
      solidPlugin({
        solid: { generate: 'universal', moduleName: '@solid-mvc/atoll-island/worker' },
        babel: BABEL,
      }),
    ],
  },`,
    );
  }
  if (next === src) {
    warn('vite.config.ts has an unrecognized shape — wire worker islands manually');
    return;
  }
  log(`      UPDATE   vite.config.ts`);
  if (!dry) writeFileSync(path, next);
}

const RECIPES = {
  tailwind(root, a) {
    installDeps(root, {
      tailwindcss: VERSIONS.tailwindcss,
      '@tailwindcss/vite': VERSIONS['@tailwindcss/vite'],
    }, { dev: true, dry: a['dry-run'] });
    patchViteConfig(root, a['dry-run']);
    writeFile(root, 'src/styles.css', T.T_STYLES_TAILWIND, {
      dry: a['dry-run'],
      force: false,
    });
    log('\nTailwind v4 is wired. Utility classes are now available in views.');
  },

  islands(root, a) {
    const fw = frameworkRange();
    installDeps(root, {
      '@solid-mvc/atoll': fw,
      '@solid-mvc/atoll-island': fw,
      '@atolljs/core': VERSIONS['@atolljs/core'],
    }, { dev: false, dry: a['dry-run'] });
    patchViteConfigIslands(root, a['dry-run']);
    log('\nWorker islands installed. Scaffold your first one:');
    log('  smvc g island ticker');
  },
};

export function cmdAdd(a) {
  const recipe = a._[0];
  if (!recipe || !RECIPES[recipe]) {
    fail(`usage: smvc add <${Object.keys(RECIPES).join('|')}>`);
  }
  const { root } = project();
  log('');
  RECIPES[recipe](root, a);
  log('');
}
