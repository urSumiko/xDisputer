#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const repair = process.argv.includes('--repair');
const remote = process.env.XDISPUTER_REMOTE || 'origin';
const branch = process.env.XDISPUTER_BRANCH || 'main';
const target = `${remote}/${branch}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim()
  };
}

function must(command, args) {
  const result = run(command, args, { inherit: true });
  if (!result.ok) process.exit(result.status);
}

function output(command, args) {
  return run(command, args).out;
}

function fail(lines) {
  console.error('worktree-sync-doctor failed.');
  for (const line of lines) console.error(`- ${line}`);
  console.error('\nSafe repair command: npm run local-state:repair');
  console.error('Manual equivalent: git stash push -u -m "backup-before-clean-sync" && git fetch origin main --prune && git reset --hard origin/main');
  process.exit(1);
}

if (!run('git', ['rev-parse', '--is-inside-work-tree']).ok) {
  fail(['Current directory is not inside a Git worktree.']);
}

must('git', ['fetch', remote, branch, '--prune']);

const status = output('git', ['status', '--porcelain=v1']);
const head = output('git', ['rev-parse', 'HEAD']);
const upstream = output('git', ['rev-parse', target]);
const base = output('git', ['merge-base', 'HEAD', target]);
const dirty = Boolean(status.trim());
const behind = head !== upstream && base === head;
const diverged = head !== upstream && base !== head && base !== upstream;
const ahead = head !== upstream && base === upstream;

if (!dirty && !behind && !diverged) {
  if (ahead) console.warn(`WARN: local branch is ahead of ${target}; this is not a mixed-state error, but push or review before sharing.`);
  console.log(`worktree-sync-doctor: ok (${head.slice(0, 7)} matches clean runnable state).`);
  process.exit(0);
}

if (!repair) {
  const issues = [];
  if (dirty) issues.push('Local tracked/untracked changes exist and can block git pull.');
  if (behind) issues.push(`Local HEAD is behind ${target}; latest website code is not applied.`);
  if (diverged) issues.push(`Local HEAD diverged from ${target}; reset or review is required.`);
  if (ahead) issues.push(`Local HEAD is ahead of ${target}; review before reset.`);
  if (dirty) issues.push(`Changed files:\n${status}`);
  fail(issues);
}

const stashMessage = `backup-before-clean-sync-${new Date().toISOString()}`;
if (dirty) {
  must('git', ['stash', 'push', '-u', '-m', stashMessage]);
}

must('git', ['reset', '--hard', target]);
console.log(`worktree-sync-doctor: repaired to ${target}.`);
if (dirty) console.log(`Local changes were backed up in git stash: ${stashMessage}`);
