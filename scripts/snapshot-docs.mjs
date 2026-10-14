// Builds a versioned docs snapshot for a release tag:
//
//   node scripts/snapshot-docs.mjs v0.1.0 [--no-build]
//
// Produces docs-v0.1.0.tar.gz at the repo root — the publish workflow
// uploads it as a release asset; assemble-pages.mjs later mounts it at
// docs/v0.1.0/ in the Pages artifact.
//
// The snapshot is the FULL docs tree (docs pages + demo mounts), so its
// iframes and assets resolve inside v<x.y.z>/ and the archive is
// self-contained. VITE_DOCS_VERSION stamps <meta solid-mvc:version> and
// a robots noindex into every page so snapshots never outrank latest.
//
// Env overrides are set on this process — the build children inherit them.
// GITHUB_REPOSITORY (owner/repo) is honored when present for CI builds.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS_PROJECTS, mountDocsTree } from './pages-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const tag = process.argv[2];
if (!/^v?\d+\.\d+\.\d+/.test(tag ?? '')) {
  console.error('usage: node scripts/snapshot-docs.mjs <tag>   e.g. v0.1.0');
  process.exit(1);
}
const ver = `v${tag.replace(/^v/, '')}`; // 0.1.0 / v0.1.0 -> v0.1.0

// owner/repo — for the Pages base path baked into canonical/OG URLs.
const slug = (process.env.GITHUB_REPOSITORY ??
  /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).repository?.url ?? ''
  )?.[1] ??
  'jwhenry3/solid-mvc'
).split('/');
const [owner, repo] = slug;

process.env.DOCS_BASE_URL = `https://${owner}.github.io/${repo}/docs/${ver}/`;
process.env.VITE_DOCS_VERSION = ver;
console.log(`snapshot: ${tag} -> ${ver}  (base ${process.env.DOCS_BASE_URL})`);

if (!process.argv.includes('--no-build')) {
  // Spawn npm without a shell: `.cmd` shims are unspawnable on Windows —
  // run npm-cli.js through the current node binary (same pattern as
  // scripts/build-pages.mjs).
  const npmCli = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  ].find((p) => p && existsSync(p));
  const NPM_CMD = npmCli ? process.execPath : 'npm';
  const NPM_ARGS = npmCli ? [npmCli] : [];
  for (const [name, cwd] of DOCS_PROJECTS) {
    // Demos build with --base=./ so asset URLs stay relative — the same
    // dist works under any mount path in the snapshot.
    const extra = name === 'docs-consumer' ? [] : ['--base=./'];
    execFileSync(NPM_CMD, [...NPM_ARGS, 'run', 'build', '--', ...extra], {
      cwd: join(root, cwd),
      stdio: 'inherit',
    });
  }
}

const stage = join(root, 'dist-snapshot');
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mountDocsTree(root, stage);

// tar -C stage . → archive root IS the docs tree; extraction into
// docs/v<x.y.z>/ at deploy time lands the files at the right depth.
// Relative paths only — Windows bsdtar reads 'C:\…' as rmt host:path syntax.
const tarball = `docs-${ver}.tar.gz`; // normalize: always docs-v<x.y.z>
execFileSync('tar', ['czf', tarball, '-C', 'dist-snapshot', '.'], { cwd: root });
rmSync(stage, { recursive: true, force: true });
console.log(`snapshot: ${tarball} written — upload it as a release asset`);
