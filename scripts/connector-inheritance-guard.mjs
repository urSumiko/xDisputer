#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const requiredScripts = {
  'connections:doctor': ['check-env-contract.mjs', 'connection-inheritance:guard'],
  'connection-inheritance:guard': ['connector-inheritance-guard.mjs'],
  'active:sync': ['xdisputer-active-sync.sh'],
  'active:sync:db': ['active:sync', '--sync-db', '--verify'],
  'supabase:doctor': ['connections:doctor'],
  'xdisputer:guard': ['repo:guard']
};

const requiredFiles = [
  {
    path: 'docs/active-context-binding.md',
    contains: ['Arisu-art/xDisputer', 'User prompt alias observed', 'Connection inheritance']
  },
  {
    path: 'docs/active-connector-inheritance.md',
    contains: ['GitHub', 'Supabase', 'Figma', 'Context7', 'Arisu-art/xDisputer', 'xdisputer-active-sync.sh']
  },
  {
    path: 'docs/active-changepoint-trace.md',
    contains: ['PR #4', 'd773d09c9cf6691892cbea202802b8a23c6d8520', '8dec3b9e6c01a4a6142dba20916ecd5a78441943']
  },
  {
    path: 'docs/xdisputer-active-sync-runbook.md',
    contains: ['connection-inheritance:guard', 'npm run active:sync -- --reset-local --verify', 'docs/xdisputer-connection-validation.sql']
  },
  {
    path: 'scripts/xdisputer-active-sync.sh',
    contains: ['--reset-local', '--stash-local', '--sync-db', 'git remote get-url origin', 'supabase db push', 'npm run connections:doctor']
  },
  {
    path: 'docs/xdisputer-connection-validation.sql',
    contains: ['notify pgrst', 'access_workspace_account_summary_v1(uuid)', 'Expected: eight rows']
  }
];

const requiredDeps = ['next', 'react', 'react-dom', '@supabase/ssr', '@supabase/supabase-js'];

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function runText(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

console.log('\n=== xDisputer connector inheritance guard ===');

const pkgText = read('package.json');
if (!pkgText) {
  fail('Missing package.json.');
} else {
  const pkg = JSON.parse(pkgText);

  for (const [scriptName, fragments] of Object.entries(requiredScripts)) {
    const script = pkg.scripts?.[scriptName];
    if (!script) {
      fail(`Missing package script: ${scriptName}`);
      continue;
    }

    for (const fragment of fragments) {
      if (!script.includes(fragment)) fail(`package script ${scriptName} is missing fragment: ${fragment}`);
    }

    ok(`package script inherited: ${scriptName}`);
  }

  for (const dep of requiredDeps) {
    if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) ok(`dependency present: ${dep}`);
    else fail(`Missing dependency: ${dep}`);
  }
}

for (const contract of requiredFiles) {
  const text = read(contract.path);
  if (!text) {
    fail(`Missing connector inheritance file: ${contract.path}`);
    continue;
  }

  for (const fragment of contract.contains) {
    if (!text.includes(fragment)) fail(`${contract.path} is missing required fragment: ${fragment}`);
  }

  ok(`connector inheritance file verified: ${contract.path}`);
}

const remote = runText('git remote get-url origin');
if (remote) {
  if (/Arisu-art\/xDisputer(?:\.git)?$/i.test(remote)) ok(`Git remote inherited: ${remote}`);
  else fail(`Git remote is not Arisu-art/xDisputer: ${remote}`);
} else {
  warn('Git remote could not be read in this shell.');
}

const branch = runText('git branch --show-current');
if (branch && branch !== 'main') warn(`Active branch is ${branch}; sync target remains main.`);
else if (branch === 'main') ok('Active branch is main.');

if (process.exitCode) {
  console.error('\nConnector inheritance guard failed. Fix the first ERROR, then rerun `npm run connection-inheritance:guard`.');
  process.exit(process.exitCode);
}

console.log('\nConnector inheritance guard passed. Expected state: GitHub, Supabase, Figma, and Context7 boundaries are documented and protected by package scripts.');
