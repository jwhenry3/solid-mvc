// CI/publish install — installs every toolchain the suites touch. The
// examples are NOT npm workspaces: each has its own lockfile and needs its
// own `npm ci` (enterprise's vite/tailwind toolchain lives in its own
// node_modules; its @solid-mvc/* imports resolve upward to the root
// workspace links).
//
// Adding an example? Add it to `projects` — ci.yml and publish.yml both
// run this script.
// Usage: node scripts/ci-install.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const at = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const projects = [
  ['root', ''],
  ['enterprise', 'examples/enterprise'],
  ['docs-consumer', 'docs-consumer'],
].map(([name, rel]) => [name, at(rel)]);

// Spawn npm without a shell: `.cmd` shims are unspawnable on Windows —
// run npm-cli.js through the current node binary instead.
const npmCli = [
  process.env.npm_execpath,
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
].find((p) => p && existsSync(p));
const NPM_CMD = npmCli ? process.execPath : 'npm';
const NPM_ARGS = npmCli ? [npmCli] : [];

for (const [name, cwd] of projects) {
  console.log(`=== npm ci: ${name} ===`);
  execFileSync(NPM_CMD, [...NPM_ARGS, 'ci'], { cwd, stdio: 'inherit' });
}
console.log('ci-install: all projects installed');
