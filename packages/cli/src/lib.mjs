/**
 * Shared helpers: naming transforms, file writing with dry-run logging,
 * package.json IO, project-root discovery, version maps, process spawn.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI_ROOT = dirname(fileURLToPath(import.meta.url));

/* ── Versions ───────────────────────────────────────────────────────
 * External dep ranges for generated projects. @solid-mvc/* ranges come
 * from the CLI's own version (the published package releases in
 * lockstep) — 0.0.0 means "unreleased checkout", so fall back to
 * `latest` for local/linked runs.
 */
export const VERSIONS = {
  'solid-js': '^1.9.10',
  'vite-plugin-solid': '^2.11.9',
  '@babel/core': '^7.26.0',
  '@babel/plugin-proposal-decorators': '^7.25.9',
  '@babel/plugin-transform-class-properties': '^7.25.9',
  '@atolljs/core': '0.1.12',
  typescript: '~5.5.0',
  vite: '^6.4.3',
  vitest: '^3.2.4',
  jsdom: '^25.0.0',
  '@types/node': '^24.19.2',
  '@solidjs/testing-library': '^0.8.10',
  tailwindcss: '^4.3.3',
  '@tailwindcss/vite': '^4.3.3',
};

export function cliVersion() {
  const pkg = JSON.parse(
    readFileSync(join(CLI_ROOT, '..', 'package.json'), 'utf8'),
  );
  return pkg.version;
}

/** The range a generated project should use for @solid-mvc/* deps. */
export function frameworkRange() {
  const v = cliVersion();
  return v === '0.0.0' ? 'latest' : `^${v}`;
}

/* ── Naming ──────────────────────────────────────────────────────── */

/** `FooBar` / `fooBar` / `foo_bar` / `fooBar-baz` → `foo-bar` */
export function toKebab(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

/** `foo-bar` → `FooBar` */
export function toPascal(name) {
  return toKebab(name)
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** `foo-bar` → `fooBar` */
export function toCamel(name) {
  const p = toPascal(name);
  return p ? p[0].toLowerCase() + p.slice(1) : p;
}

/* ── FS / logging ────────────────────────────────────────────────── */

export const log = (...a) => console.log(...a);
export const warn = (...a) => console.warn(`WARN`, ...a);
export const fail = (msg) => {
  console.error(`Error: ${msg}`);
  process.exit(1);
};

/**
 * Write `contents` at `root/rel`, mkdir -p'ing parents. `--dry-run`
 * prints instead. Existing files are skipped unless `force`; never
 * silently clobber user code.
 */
export function writeFile(root, rel, contents, { dry = false, force = false } = {}) {
  const abs = join(root, rel);
  if (existsSync(abs) && !force) {
    const tag = dry ? 'SKIP (dry)' : 'SKIP';
    log(`      ${tag}  ${rel} (already exists)`);
    return false;
  }
  const tag = dry ? 'CREATE (dry)' : 'CREATE';
  log(`      ${tag}  ${rel} (${Buffer.byteLength(contents)} bytes)`);
  if (!dry) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
  return true;
}

/** Render a %%TOKEN%% template. Tokens are uppercase-only. */
export function render(tpl, tokens) {
  let out = tpl;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replaceAll(`%%${k}%%`, String(v));
  }
  const leftovers = out.match(/%%[A-Z_]+%%/g);
  if (leftovers) fail(`unfilled template tokens: ${leftovers.join(', ')}`);
  return out;
}

/* ── Project discovery ───────────────────────────────────────────── */

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Walk up from `dir` to the nearest package.json depending on
 *  @solid-mvc/core — the project's root. Returns {root, pkg} or null. */
export function findProjectRoot(dir = process.cwd()) {
  let cur = resolve(dir);
  for (;;) {
    const pkgPath = join(cur, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = readJson(pkgPath);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@solid-mvc/core']) return { root: cur, pkg };
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

/** All @solid-mvc/* dep names declared in a package.json object. */
export function frameworkDeps(pkg) {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
    (d) => d.startsWith('@solid-mvc/'),
  );
}

/* ── Process ─────────────────────────────────────────────────────── */

/** Spawn a command in the foreground. Joins into a single shell string
 *  so npm's .cmd shims resolve on Windows (args with spaces are quoted).
 *  Returns the exit code. */
export function run(cmd, args = [], { cwd = process.cwd(), dry = false } = {}) {
  const shown = [cmd, ...args]
    .map((a) => (/[\s"']/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    .join(' ');
  if (dry) {
    log(`      RUN (dry)   ${shown}`);
    return 0;
  }
  const res = spawnSync(shown, { cwd, stdio: 'inherit', shell: true });
  return res.status ?? 1;
}

/** `npm view <pkg> version` → string, or null on failure/offline. */
export function npmViewVersion(name) {
  const res = spawnSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
    shell: true,
  });
  if (res.status !== 0) return null;
  return res.stdout.trim() || null;
}

/* ── Arg parsing (tiny, dependency-free) ─────────────────────────── */

/**
 * parseArgs-lite: returns { _: [positionals], flags }. Supports
 * `--flag`, `--flag value`, `--flag=value`, `-x` (boolean shorts only),
 * and `--no-flag` negation.
 */
export function args(argv, flags = {}) {
  const out = { _: [] };
  const aliases = { ...flags };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--no-')) {
      out[a.slice(5)] = false;
    } else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) {
        out[a.slice(2)] = argv[++i];
      } else {
        out[a.slice(2)] = true;
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = aliases[a.slice(1)] ?? a.slice(1);
      out[key] = true;
    } else {
      out._.push(a);
    }
  }
  for (const [short, long] of Object.entries(flags)) {
    if (out[short] !== undefined && out[long] === undefined) out[long] = out[short];
  }
  return out;
}

/** Normalize to a kebab-cased feature name; rejects paths/empties. */
export function featureName(raw) {
  const name = toKebab(raw ?? '');
  if (!name || name.includes('..') || name.includes('/') || name.includes(sep)) {
    fail(`"${raw}" is not a valid name — expected something like "user-card"`);
  }
  return name;
}
