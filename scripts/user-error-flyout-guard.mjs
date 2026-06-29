#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [];

function assertFile(path) {
  const ok = existsSync(path);
  checks.push({ ok, label: `file exists: ${path}` });
  return ok ? readFileSync(path, 'utf8') : '';
}

function assertIncludes(content, needle, label) {
  checks.push({ ok: content.includes(needle), label });
}

function assertCount(content, needle, expected, label) {
  const count = content.split(needle).length - 1;
  checks.push({ ok: count === expected, label: `${label} (${count}/${expected})` });
}

if (existsSync('scripts/apply-user-error-flyout-wiring.mjs')) {
  execSync('node scripts/apply-user-error-flyout-wiring.mjs', { stdio: 'inherit' });
  execSync('node scripts/apply-user-error-flyout-wiring.mjs', { stdio: 'inherit' });
}

const classifier = assertFile('lib/user-facing-error.ts');
const flyout = assertFile('components/UserErrorFlyout.tsx');
const workspace = assertFile('components/LetterGeneratorWorkspaceV2.tsx');
const safety = assertFile('scripts/phase14-local-safety-check.mjs');
const patcher = assertFile('scripts/apply-user-error-flyout-wiring.mjs');

for (const term of ['TEMPLATE', 'SOURCE_DATA', 'NETWORK', 'ACCOUNT', 'SYSTEM', 'explainWebsiteError']) {
  assertIncludes(classifier, term, `classifier handles ${term}`);
}

for (const term of ['role="dialog"', 'What to do next', 'Technical details', 'Open {issue.suggestedPanel}']) {
  assertIncludes(flyout, term, `flyout includes ${term}`);
}

assertIncludes(workspace, "import UserErrorFlyout from './UserErrorFlyout';", 'workspace imports flyout');
assertIncludes(workspace, 'activeError', 'workspace tracks active user-facing error');
assertIncludes(workspace, 'explainWebsiteError', 'workspace classifies error messages');
assertIncludes(workspace, '<UserErrorFlyout issue={activeError}', 'workspace renders flyout');
assertIncludes(safety, 'apply-user-error-flyout-wiring', 'local safety check applies flyout wiring before typecheck/build');
assertIncludes(patcher, 'normalizeActiveErrorState', 'patcher normalizes duplicate active error state');
assertIncludes(patcher, 'normalizeGenerateClear', 'patcher normalizes duplicate generate error reset');
assertCount(workspace, 'const [activeError, setActiveError] = useState<UserFacingError | null>(null);', 1, 'workspace has exactly one activeError state line');
assertCount(workspace, 'setActiveError(null);', 3, 'workspace has expected setActiveError reset calls');

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? '✅' : '❌'} ${check.label}`);
}

if (failed.length) {
  console.error(`\nUser error flyout guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nUser error flyout guard passed: ${checks.length} check(s).`);
