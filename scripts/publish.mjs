// Lockstep staged publish — `node scripts/publish.mjs <version|v*.*.*> [pkg] [--direct] [--dry-run]`.
//
// An optional package positional (`@solid-mvc/atoll`, `atoll`, or
// `packages/atoll`) narrows the run to that one package — its manifest
// alone is stamped; internal deps still stamp to the release version.
//
// Stamps every publishable packages/*/package.json with the release
// version, rewrites internal @solid-mvc/* dep ranges to match, then
// `npm stage publish`es in dependency order: core → atoll → atoll-island.
// Staged versions sit in npm's stage queue (not installable) until a
// maintainer approves with 2FA — `npm stage list/view/approve` or the
// Staged Packages tab on npmjs.com. CI runs this from a release tag; repo
// versions stay 0.0.0 as a "not yet released" marker. Requires npm CLI
// >= 11.15.0.
//
// `--direct` swaps `npm stage publish` for a plain `npm publish` — the
// one-time bootstrap, since staging requires the package to already exist
// on the registry. Run it interactively (2FA prompts per package) to
// create each package; provenance is dropped since it needs Actions OIDC.
//
// Without `--direct` the run pre-flights `npm view` on every package
// BEFORE stamping or staging: a confirmed 404 (a new package staging
// can't create) aborts immediately rather than leaving a release
// half-staged.
//
// Re-runs are safe: a package whose target version is already published
// (or staged, pending approval) is skipped rather than hard-failing — so
// a partially-completed release can just be run again.
//
// Packages with a tsconfig.build.json are compiled to dist/ before
// stamping (`npm run build` → tsc emit: .js + .d.ts). Repo exports stay
// pointed at ./src for dev — stamped manifests rewrite exports/files/types
// to dist so published tarballs ship compiled JS and consumers never
// transform framework sources (the wrong-JSX-pragma / split-module-realm
// class of bugs). Stamped manifests are restored to their pre-run bytes
// on exit (byte-for-byte, not `git checkout` — uncommitted edits
// survive). A stamped package.json must never reach a commit.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [, , tag, ...rest] = process.argv;
const dryRun = rest.includes('--dry-run');
const direct = rest.includes('--direct');

const version = tag?.replace(/^v/, '');
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(
    `usage: node scripts/publish.mjs <semver|vSemver> [package] [--direct] [--dry-run] — got "${tag ?? ''}"`,
  );
  process.exit(1);
}
const only = rest.find((a) => !a.startsWith('--'));

const REGISTRY = 'https://registry.npmjs.org';
// Spawn npm without a shell: `.cmd` shims are unspawnable on Windows
// (CVE-2024-27980 → EINVAL) and `shell: true` mangles argv (DEP0190).
// Run npm-cli.js through the current node binary instead — resolved from
// npm_execpath under `npm run`, else the standard layout beside node.
const npmCli = [
  process.env.npm_execpath,
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
].find((p) => p && existsSync(p));
const NPM_CMD = npmCli ? process.execPath : 'npm';
const NPM_ARGS = npmCli ? [npmCli] : [];
const npm = (args, opts = {}) => spawnSync(NPM_CMD, [...NPM_ARGS, ...args], {
  encoding: 'utf8',
  ...opts,
});

const read = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

// Collect publishable packages: non-private packages/*.
const packages = [];
for (const name of readdirSync(join(root, 'packages'))) {
  const dir = join(root, 'packages', name);
  if (!statSync(dir).isDirectory()) continue;
  const pkg = read(dir);
  if (!pkg.private) packages.push({ dir, pkg });
}
const names = new Set(packages.map((p) => p.pkg.name));

const selected = only
  ? packages.filter(
      ({ dir, pkg }) =>
        pkg.name === only ||
        pkg.name.replace(/^@[^/]+\//, '') === only ||
        relative(root, dir) === only ||
        relative(root, dir) === join('packages', only),
    )
  : packages;
if (only && selected.length === 0) {
  console.error(
    `unknown package "${only}" — publishable:\n  ` +
      packages.map((p) => p.pkg.name).join('\n  '),
  );
  process.exit(1);
}

/* ── Pre-flight: staging can't create packages ────────────────────────────
 * `npm stage publish` requires the package to already exist on the
 * registry. Discovering that MID-RUN leaves a partial stage — earlier
 * packages staged, the new one failed. Gate on `npm view` up front
 * instead. Skipped under --direct — a direct publish IS the bootstrap.
 */
if (!direct) {
  const missing = [];
  for (const { dir, pkg } of selected) {
    const res = npm(['view', pkg.name, 'name', '--registry', REGISTRY]);
    if (res.status === 0) continue;
    if (/E404|404/.test(res.stderr ?? '')) {
      missing.push({ name: pkg.name, dir: relative(root, dir) || '.' });
    } else {
      // Network/auth hiccup — inconclusive, not a confirmed miss.
      console.warn(
        `WARN ${pkg.name}: registry check inconclusive — ` +
          (res.stderr || String(res.error ?? 'npm view failed')).trim().split('\n')[0],
      );
    }
  }
  if (missing.length > 0) {
    const msg =
      `\n${missing.map((m) => `  ${m.name}`).join('\n')}\n\n` +
      `${missing.length} package(s) don't exist on npm — \`npm stage publish\` cannot create them.\n` +
      `Bootstrap each first (one-time, interactive 2FA):\n` +
      missing.map((m) => `  (cd ${m.dir} && npm publish)`).join('\n') +
      `\n\npublishConfig.access is already "public" — then re-run this release.`;
    if (dryRun) console.warn(`[dry-run] would abort before staging:${msg}`);
    else {
      console.error(msg);
      process.exit(1);
    }
  }
}

/* ── Build compiled packages ──────────────────────────────────────────────
 * tsconfig.build.json marks a package as "ships dist". Build before
 * stamping so `npm pack` (dry-run and real) sees the compiled tree.
 */
const isCompiled = (dir) => existsSync(join(dir, 'tsconfig.build.json'));
for (const { dir } of selected) {
  if (!isCompiled(dir)) continue;
  const res = npm(['run', 'build'], { cwd: dir, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stdout ?? '');
    console.error(res.stderr ?? '');
    console.error(`build failed in ${relative(root, dir)}`);
    process.exit(1);
  }
  console.log(`built ${relative(root, dir)}/dist`);
}

// Repo exports point at ./src for dev (workspace links resolve them);
// published tarballs ship the compiled dist/ instead. Wildcard exports
// stay extensionless — same bundler-resolution contract as ./src — while
// named entries get explicit types conditions.
const distExports = (exports) =>
  Object.fromEntries(
    Object.entries(exports ?? {}).map(([key, v]) => {
      if (typeof v !== 'string' || !v.startsWith('./src/')) return [key, v];
      const rel = v.slice('./src/'.length);
      if (rel.includes('*')) return [key, './dist/' + rel];
      const js = './dist/' + rel.replace(/\.tsx?$/, '.js');
      return [key, { types: js.replace(/\.js$/, '.d.ts'), default: js }];
    }),
  );

// Stamp version + rewrite internal dep ranges to the release version.
// Stamped manifests are stage-time artifacts: capture each original
// before writing and restore it verbatim on the way out.
const stamped = new Map(); // manifest path → original text
for (const { dir, pkg } of selected) {
  pkg.version = version;
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (names.has(dep)) pkg[field][dep] = version;
    }
  }
  if (isCompiled(dir)) {
    pkg.exports = distExports(pkg.exports);
    const main = pkg.exports?.['.'];
    if (main && typeof main === 'object' && main.types) pkg.types = main.types;
    pkg.files = (pkg.files ?? [])
      .filter((f) => !f.startsWith('!'))
      .map((f) => (f === 'src' ? 'dist' : f));
  }
  // Always write the stamped manifest — dry-run included, so `npm pack`
  // sees the real dist/files surface — and restore it verbatim on exit.
  const manifest = join(dir, 'package.json');
  if (!stamped.has(manifest)) stamped.set(manifest, readFileSync(manifest, 'utf8'));
  writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n');
}

const restoreManifests = () => {
  for (const [p, original] of stamped) writeFileSync(p, original);
  if (stamped.size) {
    console.log(`restored ${stamped.size} manifest(s) — stamped state is publish-only`);
    stamped.clear();
  }
};
process.on('exit', restoreManifests);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    restoreManifests();
    process.exit(sig === 'SIGINT' ? 130 : 143);
  });
}

// Dependency order — a package publishes after every internal dep it needs.
const order = [
  '@solid-mvc/core',
  '@solid-mvc/atoll',
  '@solid-mvc/atoll-island',
  '@solid-mvc/cli',
];
const sorted = [...selected].sort(
  (a, b) =>
    (order.indexOf(a.pkg.name) === -1 ? 99 : order.indexOf(a.pkg.name)) -
    (order.indexOf(b.pkg.name) === -1 ? 99 : order.indexOf(b.pkg.name)),
);

// Single-package runs break the lockstep assumption: internal deps stamp
// to `version` whether or not that version exists yet.
if (only) {
  for (const { pkg } of selected) {
    for (const field of ['dependencies', 'peerDependencies']) {
      for (const dep of Object.keys(pkg[field] ?? {})) {
        if (!names.has(dep)) continue;
        const res = npm(['view', `${dep}@${version}`, 'version', '--registry', REGISTRY]);
        if (res.status !== 0) {
          console.warn(
            `WARN ${pkg.name} ${field} ${dep}@${version} isn't on npm yet — ` +
              `this package won't be installable until ${dep} publishes too`,
          );
        }
      }
    }
  }
}

/* ── Transparency preamble ──────────────────────────────────────────────── */

// publishConfig.registry pins the destination in the manifest itself so a
// stray ~/.npmrc scope mapping can't silently redirect the publish.
for (const { pkg } of selected) {
  const reg = pkg.publishConfig?.registry;
  if (reg !== REGISTRY) {
    console.warn(
      `WARN ${pkg.name}: publishConfig.registry is ${reg ?? 'unset'} — expected ${REGISTRY}`,
    );
  }
}

console.log(
  process.env.NODE_AUTH_TOKEN
    ? 'auth: NODE_AUTH_TOKEN secret present — npm may use it where a package lacks OIDC trust'
    : 'auth: no NODE_AUTH_TOKEN — OIDC trusted publishing only (npm stage + provenance)',
);

if (dryRun) {
  for (const { dir, pkg } of sorted) {
    try {
      const out = execFileSync(NPM_CMD, [...NPM_ARGS, 'pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' });
      const [pack] = JSON.parse(out);
      const kb = (n) => (n / 1024).toFixed(1);
      console.log(
        `\n${pkg.name}@${version} — ${pack.entryCount ?? pack.files.length} files, ` +
          `${kb(pack.size)} kB tarball (${kb(pack.unpackedSize)} kB unpacked)`,
      );
      for (const f of pack.files) console.log(`  ${f.path}`);
    } catch {
      console.log(`\n${pkg.name}@${version} — npm pack --dry-run failed (files not listed)`);
    }
  }
}

/* ── Skip versions that are already out there ─────────────────────────────
 * Re-runs are the point: a partially-failed release, or a package that
 * got a one-time bootstrap `npm publish`, must not hard-fail the run.
 */
const published = new Set();
for (const { pkg } of sorted) {
  const res = npm(['view', `${pkg.name}@${version}`, 'version', '--registry', REGISTRY]);
  if (res.status === 0 && res.stdout.trim() === version) published.add(pkg.name);
}
let stagedLines = [];
try {
  const out = execFileSync(NPM_CMD, [...NPM_ARGS, 'stage', 'list'], { encoding: 'utf8' });
  stagedLines = out.split('\n');
} catch {
  /* no stage-queue access in this environment — the publish check still applies */
}
const stagedPending = (name) => stagedLines.some((l) => l.includes(name) && l.includes(version));

const results = [];
for (const { dir, pkg } of sorted) {
  if (published.has(pkg.name)) {
    console.log(`skip ${pkg.name}@${version} — already published`);
    results.push({ name: pkg.name, status: 'skipped — already published' });
    continue;
  }
  if (stagedPending(pkg.name)) {
    console.log(`skip ${pkg.name}@${version} — already staged, pending approval`);
    results.push({ name: pkg.name, status: 'skipped — already staged' });
    continue;
  }
  const cmd = direct
    ? ['publish', '--access', 'public']
    : ['stage', 'publish', '--access', 'public', '--provenance'];
  console.log(`${dryRun ? '[dry-run] ' : ''}npm ${cmd.join(' ')}  ${pkg.name}@${version}`);
  if (dryRun) {
    results.push({ name: pkg.name, status: 'dry-run' });
    continue;
  }
  try {
    execFileSync(NPM_CMD, [...NPM_ARGS, ...cmd], { cwd: dir, stdio: 'inherit' });
    results.push({ name: pkg.name, status: direct ? 'published' : 'staged' });
  } catch {
    results.push({ name: pkg.name, status: 'FAILED' });
    throw new Error(`${pkg.name} failed — see npm output above`);
  }
}

// The run's durable record — GitHub renders $GITHUB_STEP_SUMMARY on the
// workflow page; outside Actions the same table prints to stdout.
const table = [
  `| package | version | result |`,
  `| --- | --- | --- |`,
  ...results.map((r) => `| \`${r.name}\` | \`${version}\` | ${r.status} |`),
].join('\n');
const summary =
  `### ${direct ? 'Published' : 'Staged'} packages — ${tag}\n\n` +
  `${table}\n\n` +
  (direct
    ? ''
    : `Staged versions are **not installable** until approved — \`npm stage list\` / \`npm stage approve <id>\` (2FA), or the Staged Packages tab on npmjs.com.\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  console.log(`\n${summary}`);
}
