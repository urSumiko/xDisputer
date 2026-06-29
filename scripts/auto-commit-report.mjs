#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
};
const has = (name) => args.includes(name);

const intent = getArg('--intent', process.env.AUTO_COMMIT_INTENT || 'User requested automated repository and Codespace sync with recovery report.');
const summary = getArg('--summary', process.env.AUTO_COMMIT_SUMMARY || 'Auto-detected local code changes and recorded a recovery report.');
const problem = getArg('--problem', process.env.AUTO_COMMIT_PROBLEM || 'Codespace preview can drift from repository commits without an auditable sync and commit report.');
const commitMessage = getArg('--message', process.env.AUTO_COMMIT_MESSAGE || 'Auto report local changes');
const push = has('--push');
const verify = has('--verify');
const dryRun = has('--dry-run');
const reportRoot = 'docs/change-reports';

const ignoredPrefixes = [
  '.next/',
  '.next-quarantine/',
  '.codespace-sync/',
  'node_modules/',
  '.local-backups/'
];
const ignoredFiles = new Set([
  'tsconfig.tsbuildinfo',
  'FETCH_HEAD',
  'next',
  'node',
  'tsc'
]);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.status !== 0 && options.optional !== true) throw new Error(`${command} ${commandArgs.join(' ')} failed`);
  return (result.stdout || '').trim();
}

function git(args, options = {}) {
  return run('git', args, options);
}

function readGit(args, options = {}) {
  return git(args, { ...options, capture: true });
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'auto-change';
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseStatusEntries(output) {
  const entries = output.split('\0').filter(Boolean);
  const files = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    let oldPath = null;

    if ((status.includes('R') || status.includes('C')) && entries[index + 1]) {
      oldPath = entries[index + 1];
      index += 1;
    }

    files.push({ status, path, oldPath });
  }

  return files;
}

function shouldTrack(path) {
  if (!path) return false;
  if (ignoredFiles.has(path)) return false;
  if (path.startsWith('/')) return false;
  return !ignoredPrefixes.some((prefix) => path.startsWith(prefix));
}

function shortText(value, maxLines = 120) {
  if (!value) return '';
  const lines = value.split(/\r?\n/);
  const clipped = lines.slice(0, maxLines).join('\n');
  return lines.length > maxLines ? `${clipped}\n... clipped ${lines.length - maxLines} line(s) ...` : clipped;
}

function fileExists(path) {
  return existsSync(path);
}

function readCurrentFile(path) {
  if (!fileExists(path)) return '';
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '[binary or unreadable current file]';
  }
}

function readHeadFile(path) {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', shell: process.platform === 'win32', stdio: 'pipe' });
  if (result.status !== 0) return '';
  return result.stdout || '';
}

function buildReport({ files, reportPath, headBefore }) {
  const diffStat = readGit(['diff', '--stat', '--', ...files.map((item) => item.path)], { optional: true });
  const nameStatus = readGit(['diff', '--name-status', '--', ...files.map((item) => item.path)], { optional: true });
  const report = [];
  report.push(`# Auto Commit Recovery Report`);
  report.push('');
  report.push(`- Created: ${new Date().toISOString()}`);
  report.push(`- Base commit before auto-report: ${headBefore}`);
  report.push(`- Intent: ${intent}`);
  report.push(`- Summary: ${summary}`);
  report.push(`- Problem / wrong behavior: ${problem}`);
  report.push('');
  report.push(`## Changed files`);
  report.push('');
  report.push('```text');
  report.push(nameStatus || files.map((item) => `${item.status.trim() || '??'}\t${item.path}`).join('\n'));
  report.push('```');
  report.push('');
  report.push(`## Diff stat`);
  report.push('');
  report.push('```text');
  report.push(diffStat || 'No diff stat available.');
  report.push('```');
  report.push('');
  report.push(`## Recovery`);
  report.push('');
  report.push(`To inspect this change later:`);
  report.push('');
  report.push('```bash');
  report.push(`git show --stat HEAD`);
  report.push(`git show --name-status HEAD`);
  report.push('```');
  report.push('');
  report.push(`To revert this auto-commit after it is created:`);
  report.push('');
  report.push('```bash');
  report.push(`git revert HEAD`);
  report.push('```');
  report.push('');
  report.push(`## File-by-file old/latest preview`);
  report.push('');

  for (const file of files) {
    const oldContent = readHeadFile(file.oldPath || file.path);
    const newContent = readCurrentFile(file.path);
    report.push(`### ${file.path}`);
    report.push('');
    report.push(`- Status: ${file.status.trim() || 'modified'}`);
    if (file.oldPath) report.push(`- Previous path: ${file.oldPath}`);
    report.push('');
    report.push(`#### Old version preview`);
    report.push('');
    report.push('```text');
    report.push(shortText(oldContent) || '[new file or old version unavailable]');
    report.push('```');
    report.push('');
    report.push(`#### Latest version preview`);
    report.push('');
    report.push('```text');
    report.push(shortText(newContent) || '[deleted file or latest version unavailable]');
    report.push('```');
    report.push('');
  }

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${report.join('\n')}\n`);
}

function runVerification() {
  if (!verify) return;
  if (existsSync('scripts/client-account-popover-guard.mjs')) run('node', ['scripts/client-account-popover-guard.mjs']);
  if (existsSync('scripts/workflow-split-guard.mjs')) run('node', ['scripts/workflow-split-guard.mjs']);
  if (existsSync('scripts/performance-modernization-guard.mjs')) run('node', ['scripts/performance-modernization-guard.mjs']);
  run('npm', ['run', 'ui-source:guard']);
  run('npm', ['run', 'typecheck']);
}

function main() {
  const inside = readGit(['rev-parse', '--is-inside-work-tree'], { optional: true });
  if (inside !== 'true') throw new Error('Run this command inside the xDisputer Git repository.');
  const headBefore = readGit(['rev-parse', 'HEAD']);
  const statusOutput = readGit(['status', '--porcelain=v1', '-z']);
  const files = parseStatusEntries(statusOutput).filter((item) => shouldTrack(item.path));

  if (!files.length) {
    console.log('No trackable local changes detected. Nothing to auto-commit.');
    return;
  }

  const reportPath = join(reportRoot, `${timestamp()}-${slug(summary)}.md`);
  buildReport({ files, reportPath, headBefore });
  console.log(`Created report: ${reportPath}`);

  if (dryRun) {
    console.log('Dry run enabled. No commit was created.');
    return;
  }

  runVerification();
  run('git', ['add', '--', reportPath, ...files.map((item) => item.path)]);
  run('git', ['commit', '-m', commitMessage]);

  if (push) run('git', ['push', 'origin', 'main']);
  console.log('Auto commit with recovery report complete.');
}

main();
