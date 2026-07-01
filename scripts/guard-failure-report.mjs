#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const guards = [
  'scripts/guard-policy-canvas-guard-v3.mjs',
  'scripts/guard-policy-consistency-v2.mjs',
  'scripts/no-autowrite-ui-guard.mjs',
  'scripts/ui-shell-registry-guard.mjs',
  'scripts/ui-intelligence-guard.mjs',
  'scripts/performance-boost-guard.mjs',
  'scripts/feature-ownership-guard.mjs',
  'scripts/repo-precision-audit.mjs',
  'scripts/notification-ui-frontend-guard.mjs',
  'scripts/assistant-chip-retirement-guard.mjs',
  'scripts/manager-master-lightweight-ui-guard.mjs',
  'scripts/repo-rearchitecture-roadmap-guard.mjs',
  'scripts/modernization-canvas-next-actions-guard.mjs',
  'scripts/css-ownership-guard.mjs',
  'scripts/manager-console-workflow-guard.mjs',
  'scripts/manager-report-workflow-guard.mjs',
  'scripts/notification-output-activity-guard.mjs',
  'scripts/website-stability-guard.mjs',
  'scripts/client-account-popover-guard.mjs',
  'scripts/client-critical-gaps-guard.mjs',
  'scripts/template-workspace-contract-guard.mjs',
  'scripts/dti-check.mjs',
  'scripts/dynamic-template-anchor-guard.mjs',
  'scripts/manager-owned-docx-guard.mjs',
  'scripts/client-template-runtime-guard.mjs',
  'scripts/responsive-integrity-guard.mjs',
  'scripts/theme-consistency-guard.mjs',
  'scripts/theme-governance-contract-guard.mjs',
  'scripts/master-ui-workspace-guard.mjs',
  'scripts/ui-layout-contract-guard.mjs',
  'scripts/ui-collapse-contract-guard.mjs',
  'scripts/console-shell-contract-guard.mjs',
  'scripts/manager-visible-switch-contract-guard.mjs',
  'scripts/console-roadmap-guard.mjs',
  'scripts/template-execution-guard.mjs',
  'scripts/manager-template-roadmap-guard.mjs',
  'scripts/manager-template-database-guard.mjs',
  'scripts/template-cloud-loading-guard.mjs'
];

const failures = [];

function relevantLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (
      line.includes(' failed') ||
      line.startsWith('- ') ||
      line.includes('Error:') ||
      line.includes('missing ') ||
      line.includes('must ')
    ));
}

for (const guard of guards) {
  if (!existsSync(guard)) continue;
  const result = spawnSync('node', [guard], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });

  if (result.status === 0) {
    console.log(`${guard}: ok`);
    continue;
  }

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const lines = relevantLines(output);
  failures.push({ guard, status: result.status, lines: lines.length ? lines : [output.trim() || 'failed without output'] });
  console.log(`${guard}: failed`);
}

if (!failures.length) {
  console.log('All guard scripts passed.');
  process.exit(0);
}

console.error(`\nAll-guard failure report: ${failures.length} failing guard script(s).`);
for (const failure of failures) {
  console.error(`\n${failure.guard}`);
  for (const line of failure.lines) console.error(`  ${line}`);
}
process.exit(1);
