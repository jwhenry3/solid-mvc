#!/usr/bin/env node
// Deprecate the 0.0.0 / 0.0.0-stage placeholder versions on npm.
//
//   node scripts/deprecate-placeholders.mjs            # browser OTP flow per package
//   node scripts/deprecate-placeholders.mjs --otp=123456
//
// Safe to re-run: deprecating an already-deprecated version just rewrites
// the message.

import { spawnSync } from 'node:child_process';

const PACKAGES = ['core', 'atoll', 'atoll-island', 'cli'];
const SPEC = '0.0.0 || 0.0.0-stage';
const MESSAGE = 'development placeholder - use ^0.1.0';

const otpArg = process.argv.find((a) => a.startsWith('--otp='));
const otp = otpArg ? otpArg.split('=')[1] : null;

for (const name of PACKAGES) {
  const cmd =
    `npm deprecate "@solid-mvc/${name}@${SPEC}" "${MESSAGE}"` +
    (otp ? ` --otp=${otp}` : '');
  console.log(`\n→ ${cmd}`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\nDone.');
