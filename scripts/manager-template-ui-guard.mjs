#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [];
function read(path) { const ok = existsSync(path); checks.push({ ok, label: `file exists: ${path}` }); return ok ? readFileSync(path, 'utf8') : ''; }
function has(file, term, label) { checks.push({ ok: file.includes(term), label }); }
function count(file, term, expected, label) { const actual = file.split(term).length - 1; checks.push({ ok: actual === expected, label: `${label} (${actual}/${expected})` }); }

if (existsSync('scripts/apply-manager-template-ui-wiring.mjs')) {
  execSync('node scripts/apply-manager-template-ui-wiring.mjs', { stdio: 'inherit' });
  execSync('node scripts/apply-manager-template-ui-wiring.mjs', { stdio: 'inherit' });
}

const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');
const progressive = read('components/TemplateProgressiveWorkspace.tsx');
const configurator = read('components/TemplatePacketConfigurator.tsx');
const patcher = read('scripts/apply-manager-template-ui-wiring.mjs');
const manifest = read('lib/generation-manifest.ts');
const status = read('docs/manager-template-scope-implementation-status.md');
const page = read('app/system/manager-templates/page.tsx');

has(workspace, 'managerTemplateScope', 'workspace tracks manager template scope');
has(workspace, 'MANAGER_TEMPLATE_ASSET', 'workspace uses manager template source');
has(progressive, 'Manager controls default templates', 'template UI explains manager defaults');
has(patcher, 'normalizeReadOnlyReason', 'patcher normalizes duplicate readOnlyReason lines');
has(patcher, 'normalizePolicyPanel', 'patcher normalizes duplicate policy panels');
has(manifest, 'managerTemplateProvenance', 'manifest records manager provenance');
has(status, 'Roadmap status', 'status doc reports roadmap state');
has(page, 'Manager template library', 'manager template page exists');
count(configurator, 'const readOnlyReason = managerTemplateLockMessage(managerTemplateScope);', 1, 'configurator has exactly one readOnlyReason declaration');
count(configurator, 'template-manager-policy-inline', 1, 'configurator has exactly one manager policy panel');

checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));
const failed = checks.filter((check) => !check.ok);
if (failed.length) process.exit(1);
console.log(`\nManager template UI guard passed: ${checks.length} check(s).`);
