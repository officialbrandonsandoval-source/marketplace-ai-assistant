#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

function run(cmd, opts = {}) {
  execSync(cmd, {
    stdio: 'inherit',
    ...opts,
  });
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts,
  }).trim();
}

function main() {
  const root = new URL('..', import.meta.url);
  const cwd = root.pathname;

  if (!existsSync(new URL('../package.json', import.meta.url))) {
    throw new Error('Expected to be run from backend/ (package.json not found)');
  }

  // 1) Build + "test" (type-check)
  run('npm run build', { cwd });
  run('npm run type-check', { cwd });

  // 2) Only commit if there are changes
  const porcelain = runQuiet('git status --porcelain', { cwd });
  if (!porcelain) {
    console.log('No git changes; skipping commit/push.');
    return;
  }

  // 3) Stage everything except secrets/build outputs (relies on .gitignore)
  run('git add -A', { cwd });

  // Re-check staged changes. If nothing is staged, stop.
  const staged = runQuiet('git diff --cached --name-only', { cwd });
  if (!staged) {
    console.log('No staged changes after add; skipping commit/push.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const message = process.env.AUTO_COMMIT_MESSAGE || `chore(backend): build+typecheck ${stamp}`;

  run(`git commit -m "${message.replace(/\"/g, '\\"')}"`, { cwd });
  run('git push', { cwd });
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
