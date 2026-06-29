#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const strictEnv = process.argv.includes('--strict-env');

const requiredRuntimeEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL'
];

const expectedPackageScripts = [
  'init:connections',
  'connections:doctor',
  'active:sync',
  'active:sync:db',
  'xdisputer:guard'
];

const sourceContracts = [
  {
    path: 'docs/active-context-binding.md',
    contains: ['Arisu-art/xDisputer', 'Supabase target', 'access_workspace_attention_queue_v1']
  },
  {
    path: 'docs/xdisputer-connection-validation.sql',
    contains: ['access_workspace_account_summary_v1(uuid)', 'access_workspace_account_directory_v1(uuid,text,text,integer,integer)', 'access_workspace_attention_queue_v1(uuid,integer)']
  },
  {
    path: 'docs/xdisputer-active-sync-runbook.md',
    contains: ['npm run active:sync', 'npm run active:sync:db', 'Supabase-only']
  },
  {
    path: 'lib/saas/account-directory.ts',
    contains: ['access_workspace_account_summary_v1', 'access_workspace_account_directory_v1', 'access_workspace_attention_queue_v1']
  },
  {
    path: 'app/api/control/profile/route.ts',
    contains: ['access_workspace_master_control_v1', 'access_workspace_manager_control_v1']
  },
  {
    path: 'supabase/migrations/20260614090000_phase_12b_active_connection_rpc_contract.sql',
    contains: ['access_workspace_account_summary_v1', 'access_workspace_account_directory_v1', 'access_workspace_attention_queue_v1', 'notify pgrst']
  }
];

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

console.log('\n=== xDisputer Supabase connection doctor ===');

const remote = runText('git remote get-url origin');
if (remote) {
  if (/Arisu-art\/xDisputer(?:\.git)?$/i.test(remote)) {
    ok(`Git remote is bound to Arisu-art/xDisputer (${remote})`);
  } else {
    fail(`Git remote is not Arisu-art/xDisputer: ${remote}`);
  }
} else {
  warn('Git remote could not be read in this shell.');
}

const branch = runText('git branch --show-current');
if (branch) {
  if (branch === 'main') ok('Active branch is main.');
  else warn(`Active branch is ${branch}; use main before sync.`);
}

const pkgText = read('package.json');
if (!pkgText) {
  fail('Missing package.json.');
} else {
  const pkg = JSON.parse(pkgText);
  for (const scriptName of expectedPackageScripts) {
    if (pkg.scripts?.[scriptName]) ok(`package script exists: ${scriptName}`);
    else fail(`Missing package script: ${scriptName}`);
  }
}

for (const contract of sourceContracts) {
  const text = read(contract.path);
  if (!text) {
    fail(`Missing source contract file: ${contract.path}`);
    continue;
  }

  for (const fragment of contract.contains) {
    if (!text.includes(fragment)) fail(`${contract.path} is missing required fragment: ${fragment}`);
  }

  ok(`Source contract verified: ${contract.path}`);
}

const envFiles = ['.env.local', '.env.production.local', '.env.example'];
const readableEnvFiles = envFiles.filter((file) => existsSync(file));

if (!readableEnvFiles.length) {
  const message = 'No local env file found. Create .env.local from .env.example and set the Supabase public runtime keys.';
  if (strictEnv) fail(message);
  else warn(message);
} else {
  for (const file of readableEnvFiles) {
    const text = read(file);
    const missing = requiredRuntimeEnv.filter((key) => !new RegExp(`^${key}=.+`, 'm').test(text));
    if (missing.length) {
      const message = `${file} missing runtime env: ${missing.join(', ')}`;
      if (strictEnv && file !== '.env.example') fail(message);
      else warn(message);
    } else {
      ok(`${file} contains required public runtime env keys.`);
    }
  }
}

const capTerms = ['generation limit', 'output limit', 'usage-cap', 'usage cap', 'cap blocked'];
const scannedPaths = [
  'app/api/control/profile/route.ts',
  'lib/saas/account-directory.ts',
  'docs/active-context-binding.md'
];

for (const file of scannedPaths) {
  const text = read(file).toLowerCase();
  const hit = capTerms.find((term) => text.includes(term));
  if (hit && file !== 'docs/active-context-binding.md') {
    fail(`${file} contains a forbidden cap phrase: ${hit}`);
  }
}

if (process.exitCode) {
  console.error('\nConnection doctor failed. Fix the first ERROR, then rerun `npm run connections:doctor`.');
  process.exit(process.exitCode);
}

console.log('\nConnection doctor passed. Expected state: GitHub repo, Supabase RPC contracts, local env keys, and no-output-limit rules are aligned.');
