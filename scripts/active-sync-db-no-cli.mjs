#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const requiredMigrations = [
  ['supabase/migrations/20260622121500_generation_output_activity_db_sync.sql', ['sync_generation_output_activity_v1', 'generation_runs_sync_output_activity', 'per_output_pay']],
  ['supabase/migrations/20260622130000_unified_generation_output_notification_sync.sql', ['sync_generation_output_activity_v1', 'sync_manager_output_activity_notifications_v1', 'generation_runs_sync_output_activity']],
  ['supabase/migrations/20260622134500_output_decision_client_notification_trigger.sql', ['sync_output_activity_decision_notification_v1', 'manager_output_decision_notify_client']],
  ['supabase/migrations/20260622135000_realtime_entitlement_refresh.sql', ['client_entitlement_limits', 'generation_runs', 'supabase_realtime']],
  ['supabase/migrations/20260622141000_canonical_output_activity_notification_sync_v2.sql', ['manager_output_approvals_generation_run_id_unique', 'notifications_output_activity_href_unique']],
  ['supabase/migrations/20260622143000_fix_client_payroll_profile_ambiguous_manager_id.sql', ['p.manager_id', 'mus.manager_id', 'client_payroll_profile_v1']],
  ['supabase/migrations/20260622144500_notification_recipient_role_normalizer.sql', ['normalize_notification_recipient_role_v1', 'notifications_normalize_recipient_role', 'recipient_role']],
  ['supabase/migrations/20260630153000_output_activity_decision_notification_rpc_repair.sql', ['sync_output_activity_decision_notification_v1(activity_id_input uuid)', 'manager_output_decision_notify_client', 'reload schema']]
];

const validationSqlPath = 'docs/xdisputer-connection-validation.sql';
const reportDir = '.xdisputer-reports';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function read(path) {
  if (!existsSync(path)) fail(`Missing required SQL file: ${path}`);
  return readFileSync(path, 'utf8').trim();
}

function verifyRequiredMigrations() {
  for (const [path, markers] of requiredMigrations) {
    const sql = read(path);
    for (const marker of markers) {
      if (!sql.includes(marker)) fail(`Migration ${path} is missing required marker: ${marker}`);
    }
  }
  read(validationSqlPath);
}

function sqlSection(title, path, sql) {
  return [
    '',
    '-- ============================================================================',
    `-- ${title}`,
    `-- Source: ${path}`,
    '-- ============================================================================',
    '',
    sql,
    ''
  ].join('\n');
}

function buildManualBundle() {
  const generatedAt = new Date().toISOString();
  const sections = [
    '-- xDisputer manual Supabase sync bundle',
    `-- Generated at: ${generatedAt}`,
    '-- Repository: urSumiko/xDisputer',
    '-- Safety contract: this file is generated only; no Supabase CLI command is executed by the generator.',
    '-- Review this SQL, paste it into the Supabase Dashboard SQL Editor for the selected project, then run the validation section.',
    '',
    "notify pgrst, 'reload schema';"
  ];

  for (const [path] of requiredMigrations) {
    sections.push(sqlSection('Required migration', path, read(path)));
  }

  sections.push(sqlSection('Post-sync validation', validationSqlPath, read(validationSqlPath)));
  sections.push('', '-- End of xDisputer manual Supabase sync bundle.');

  return sections.join('\n');
}

verifyRequiredMigrations();
mkdirSync(reportDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bundlePath = join(reportDir, `manual-supabase-sync-${stamp}.sql`);
const latestPath = join(reportDir, 'manual-supabase-sync.latest.sql');
const bundle = buildManualBundle();

writeFileSync(bundlePath, `${bundle}\n`, 'utf8');
writeFileSync(latestPath, `${bundle}\n`, 'utf8');

console.log('\nManual Supabase SQL bundle prepared.');
console.log(`- ${bundlePath}`);
console.log(`- ${latestPath}`);
console.log('\nNext step: open the latest bundle, review it, paste it into the Supabase Dashboard SQL Editor for the selected project, and execute it there.');
console.log('Then rerun: npm run connections:doctor && npm run typecheck && npm run build');
