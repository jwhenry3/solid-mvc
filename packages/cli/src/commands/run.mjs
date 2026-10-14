/**
 * `pmvc serve|build|test` — delegate to the project's vite/vitest, the
 * `ng serve` / `ng build` / `ng test` equivalents. All args pass through
 * to the underlying tool except the few smvc owns (--watch for test,
 * --no-typecheck for build).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, readJson, run, fail } from '../lib.mjs';

function projectRoot() {
  const found = findProjectRoot();
  if (!found) fail('not inside a SolidMVC project (no @solid-mvc/core dependency found)');
  return found.root;
}

/**
 * Run a devDependency's bin via `node <bin>` — resolves through the
 * package's own manifest, so it works cross-platform without npx/shell
 * shims and never falls back to a registry download.
 */
function execBin(pkg, argv, cwd) {
  const pkgJson = join(cwd, 'node_modules', pkg, 'package.json');
  if (!existsSync(pkgJson)) {
    fail(`${pkg} is not installed — run \`npm install\` (or check package.json devDependencies)`);
  }
  const manifest = readJson(pkgJson);
  const bin =
    typeof manifest.bin === 'string'
      ? manifest.bin
      : (manifest.bin?.[pkg] ?? manifest.bin?.[Object.keys(manifest.bin ?? {})[0]]);
  if (!bin) fail(`${pkg} declares no executable bin`);
  return run('node', [join(cwd, 'node_modules', pkg, bin), ...argv], { cwd });
}

/** Strip pmvc-owned flags from a passthrough argv; returns {rest, had}. */
function take(argv, flag) {
  const i = argv.indexOf(flag);
  return { rest: argv.filter((_, j) => j !== i), had: i !== -1 };
}

export function cmdServe(argv) {
  process.exitCode = execBin('vite', argv, projectRoot());
}

export function cmdBuild(argv) {
  const root = projectRoot();
  const { rest, had: noTypecheck } = take(argv, '--no-typecheck');
  // Mirror the repo convention: typecheck is part of the build.
  if (!noTypecheck) {
    const code = execBin('typescript', ['--noEmit'], root);
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
  process.exitCode = execBin('vite', ['build', ...rest], root);
}

export function cmdTest(argv) {
  const root = projectRoot();
  const { rest, had: watch } = take(argv, '--watch');
  process.exitCode = execBin('vitest', [...(watch ? [] : ['run']), ...rest], root);
}
