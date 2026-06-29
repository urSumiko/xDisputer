#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const watch = args.has('--watch');
const verify = args.has('--verify');
const push = args.has('--push');
const install = args.has('--install');
const noReset = args.has('--no-reset');
const intervalMs = Number(process.env.CODESPACE_SYNC_INTERVAL_MS || 30000);
const remote = process.env.CODESPACE_SYNC_REMOTE || 'origin';
const branch = process.env.CODESPACE_SYNC_BRANCH || 'main';
const stateDir = '.codespace-sync';
const stateFile = join(stateDir, 'last-sync.json');

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.status !== 0 && options.optional !== true) throw new Error(`${command} ${commandArgs.join(' ')} failed`);
  return (result.stdout || '').trim();
}

function git(commandArgs, options = {}) {
  return run('git', commandArgs, options);
}

function readGit(commandArgs, options = {}) {
  return run('git', commandArgs, { ...options, capture: true });
}

function writeState(state) {
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  writeFileSync(stateFile, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function ensureRepo() {
  const inside = readGit(['rev-parse', '--is-inside-work-tree'], { optional: true });
  if (inside !== 'true') throw new Error('Run this command inside the xDisputer Git repository.');
  const activeBranch = readGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (activeBranch !== branch) throw new Error(`Expected branch ${branch}, but current branch is ${activeBranch}.`);
}

function requireCleanWorktree() {
  const status = readGit(['status', '--porcelain']);
  if (!status) return;
  console.error('\nCodespace sync stopped because local files are modified.');
  console.error('No remote update was applied. Commit, stash, or restore local changes first.');
  console.error('\nChanged files:\n');
  console.error(status);
  console.error('\nThen run: npm run codespace:sync');
  process.exit(2);
}

function maybeResetNext() {
  if (noReset || !existsSync('scripts/reset-next-dev-cache.mjs')) return;
  run('npm', ['run', 'next:reset']);
}

function maybeInstall() {
  if (install && existsSync('package.json')) run('npm', ['install']);
}

function runVerification() {
  if (!verify) return;
  if (existsSync('scripts/client-account-popover-guard.mjs')) run('node', ['scripts/client-account-popover-guard.mjs']);
  if (existsSync('scripts/workflow-split-guard.mjs')) run('node', ['scripts/workflow-split-guard.mjs']);
  if (existsSync('scripts/performance-modernization-guard.mjs')) run('node', ['scripts/performance-modernization-guard.mjs']);
  run('npm', ['run', 'ui-source:guard']);
  run('npm', ['run', 'typecheck']);
}

function syncOnce() {
  ensureRepo();
  requireCleanWorktree();

  console.log(`Sync check: ${remote}/${branch}`);
  git(['fetch', remote, branch, '--prune']);

  const remoteRef = `${remote}/${branch}`;
  const localHead = readGit(['rev-parse', 'HEAD']);
  const remoteHead = readGit(['rev-parse', remoteRef]);
  const base = readGit(['merge-base', 'HEAD', remoteRef]);

  if (localHead === remoteHead) {
    console.log('Codespace is already on the latest repo commit.');
    writeState({ status: 'up-to-date', branch, remote, localHead, remoteHead });
    maybeResetNext();
    runVerification();
    return;
  }

  if (base === localHead) {
    console.log(`Fast-forwarding Codespace to ${remoteHead.slice(0, 7)}.`);
    git(['pull', '--ff-only', remote, branch]);
    writeState({ status: 'pulled', branch, remote, from: localHead, to: remoteHead });
    maybeInstall();
    maybeResetNext();
    runVerification();
    console.log('Codespace now has the latest repo code. Restart dev or hard-refresh the preview.');
    return;
  }

  if (base === remoteHead) {
    console.log('Codespace has local commits that are not on GitHub yet.');
    if (push) {
      git(['push', remote, branch]);
      writeState({ status: 'pushed', branch, remote, localHead, remoteHead });
      console.log('Committed local changes were pushed to GitHub.');
      return;
    }
    writeState({ status: 'ahead-not-pushed', branch, remote, localHead, remoteHead });
    console.log('Run npm run codespace:publish to push committed local changes.');
    return;
  }

  writeState({ status: 'diverged', branch, remote, localHead, remoteHead, base });
  throw new Error('Local and remote history diverged. Resolve manually to avoid losing work.');
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!watch) {
    syncOnce();
    return;
  }
  console.log(`Watching ${remote}/${branch} every ${Math.round(intervalMs / 1000)} seconds.`);
  while (true) {
    try {
      syncOnce();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
