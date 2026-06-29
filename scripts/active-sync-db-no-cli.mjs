#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredMigrations = [
  ['supabase/migrations/20260622121500_generation_output_activity_db_sync.sql', ['sync_generation_output_activity_v1', 'generation_runs_sync_output_activity', 'per_output_pay']],
  ['supabase/migrations/20260622130000_unified_generation_output_notification_sync.sql', ['sync_generation_output_activity_v1', 'sync_manager_output_activity_notifications_v1', 'generation_runs_sync_output_activity']],
  ['supabase/migrations/20260622134500_output_decision_client_notification_trigger.sql', ['sync_output_activity_decision_notification_v1', 'manager_output_decision_notify_client']],
  ['supabase/migrations/20260622135000_realtime_entitlement_refresh.sql', ['client_entitlement_limits', 'generation_runs', 'supabase_realtime']],
  ['supabase/migrations/20260622141000_canonical_output_activity_notification_sync_v2.sql', ['manager_output_approvals_generation_run_id_unique', 'notifications_output_activity_href_unique']],
  ['supabase/migrations/20260622143000_fix_client_payroll_profile_ambiguous_manager_id.sql', ['p.manager_id', 'mus.manager_id', 'client_payroll_profile_v1']],
  ['supabase/migrations/20260622144500_notification_recipient_role_normalizer.sql', ['normalize_notification_recipient_role_v1', 'notifications_normalize_recipient_role', 'recipient_role']]
];

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const item = line.trim();
    if (!item || item.startsWith('#')) continue;
    const index = item.indexOf('=');
    if (index < 1) continue;
    const key = item.slice(0, index).trim();
    let value = item.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const fileEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...readEnvFile('.env.development.local') };
const env = { ...process.env, ...fileEnv };
const value = (key) => env[key] || '';

function projectRefFromUrl(url) {
  return String(url || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] || '';
}

function readProjectRef() {
  return value('SUPABASE_PROJECT_REF')
    || value('SUPABASE_PROJECT_ID')
    || projectRefFromUrl(value('NEXT_PUBLIC_SUPABASE_URL'))
    || (existsSync('supabase/.temp/project-ref') ? readFileSync('supabase/.temp/project-ref', 'utf8').trim() : '');
}

function hasCommand(command) {
  return spawnSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [command] : ['-v', command], { stdio: 'ignore', shell: true }).status === 0;
}

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', env }).status === 0;
}

function verifyRequiredMigrations() {
  for (const [path, markers] of requiredMigrations) {
    if (!existsSync(path)) {
      console.error(`Missing required migration: ${path}`);
      process.exit(1);
    }
    const sql = readFileSync(path, 'utf8');
    for (const marker of markers) {
      if (!sql.includes(marker)) {
        console.error(`Migration ${path} is missing required marker: ${marker}`);
        process.exit(1);
      }
    }
  }
}

function printFallback() {
  console.error('\nDatabase push failed before all required migrations were confirmed.');
  console.error('Strong fallback A: set SUPABASE_DB_URL to the IPv4 transaction pooler URI, then rerun npm run active:sync:db.');
  console.error('Strong fallback B: set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF, then rerun npm run active:sync:db.');
  console.error('Manual fallback: paste these SQL files into Supabase SQL Editor in this order:');
  for (const [path] of requiredMigrations) console.error(`- ${path}`);
}

verifyRequiredMigrations();

const executable = hasCommand('supabase') ? 'supabase' : 'npx';
const prefix = executable === 'supabase' ? [] : ['--yes', 'supabase@latest'];
const dbUrl = value('SUPABASE_DB_URL') || value('DATABASE_URL') || value('POSTGRES_URL');
const projectRef = readProjectRef();

console.log('Preparing Supabase remote migration push.');
console.log('Skipping local Docker status checks; this runner targets the hosted project only.');

if (dbUrl) {
  console.log('Using direct database URL migration push.');
  if (!run(executable, [...prefix, 'db', 'push', '--db-url', dbUrl, '--include-all'])) {
    printFallback();
    process.exit(1);
  }
  console.log('Supabase database migration push completed through DB URL.');
  process.exit(0);
}

if (!projectRef) {
  console.error('Missing Supabase project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.');
  printFallback();
  process.exit(1);
}

if (!value('SUPABASE_ACCESS_TOKEN')) {
  console.error('Missing non-interactive Supabase CLI auth in this shell. Interactive login may not be visible to a later npx db push process.');
  console.error('Set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL, then rerun npm run active:sync:db.');
  printFallback();
  process.exit(1);
}

env.SUPABASE_PROJECT_REF = projectRef;

console.log(`Linking Supabase project ${projectRef}.`);
if (!run(executable, [...prefix, 'link', '--project-ref', projectRef])) {
  printFallback();
  process.exit(1);
}

console.log('Pushing Supabase migrations to the linked remote project.');
if (!run(executable, [...prefix, 'db', 'push', '--linked', '--include-all'])) {
  printFallback();
  process.exit(1);
}

console.log('Supabase linked remote migration push completed.');
