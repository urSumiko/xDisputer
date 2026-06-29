#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function assertFile(path) {
  const ok = existsSync(path);
  checks.push({ ok, label: `file exists: ${path}` });
  return ok ? readFileSync(path, 'utf8') : '';
}

function assertIncludes(content, needle, label) {
  checks.push({ ok: content.includes(needle), label });
}

const control = assertFile('lib/readiness-checklist-control.ts');
const preflight = assertFile('lib/preflight-validation.ts');
const component = assertFile('components/GenerationPreflightChecklist.tsx');

assertIncludes(control, 'READINESS_CHECKLIST_DISABLED = true', 'readiness checklist global switch is disabled');
assertIncludes(preflight, 'DISABLED_PREFLIGHT_RESULT', 'preflight returns a disabled result object');
assertIncludes(preflight, 'ready: true', 'disabled preflight cannot block generation');
assertIncludes(preflight, 'blockers: []', 'disabled preflight has no blockers');
assertIncludes(preflight, 'warnings: []', 'disabled preflight has no warnings');
assertIncludes(preflight, 'checks: []', 'disabled preflight has no visible checks');
assertIncludes(preflight, 'preflightFailureMessage', 'preflight failure helper remains exported');
assertIncludes(component, 'if (READINESS_CHECKLIST_DISABLED) return null', 'readiness checklist UI renders nothing while disabled');

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? '✅' : '❌'} ${check.label}`);
}

if (failed.length) {
  console.error(`\nReadiness checklist disabled guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nReadiness checklist disabled guard passed: ${checks.length} check(s).`);
