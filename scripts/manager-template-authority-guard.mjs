#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [];
function read(path) { const ok = existsSync(path); checks.push({ ok, label: `file exists: ${path}` }); return ok ? readFileSync(path, 'utf8') : ''; }
function has(source, term, label) { checks.push({ ok: source.includes(term), label }); }
function notHas(source, term, label) { checks.push({ ok: !source.includes(term), label }); }

if (existsSync('scripts/apply-manager-template-workspace-state-wiring.mjs')) {
  execSync('node scripts/apply-manager-template-workspace-state-wiring.mjs', { stdio: 'inherit' });
  execSync('node scripts/apply-manager-template-workspace-state-wiring.mjs', { stdio: 'inherit' });
}

const authority = read('lib/manager-template-authority.ts');
const ui = read('lib/manager-template-ui.ts');
const progressive = read('components/TemplateProgressiveWorkspace.tsx');
const packet = read('components/TemplatePacketConfigurator.tsx');
const managerClient = read('components/ManagerTemplateWorkspaceClient.tsx');
const summary = read('components/ManagerTemplateLibraryStatus.tsx');
const pkg = read('package.json');

has(authority, "'MANAGER_EDIT'", 'authority model defines manager edit mode');
has(authority, "'CLIENT_READONLY'", 'authority model defines client read-only mode');
has(authority, 'summarizeTemplateQuality', 'authority model summarizes template quality');
has(authority, 'summarizeTemplateProvenance', 'authority model summarizes template provenance');
has(ui, 'resolveTemplateAuthority', 'legacy UI copy routes through authority model');
has(progressive, 'resolveTemplateAuthority', 'progressive workflow uses authority model');
has(progressive, 'data-template-authority-mode', 'progressive workflow exposes authority mode to UI');
has(packet, 'resolveTemplateAuthority', 'packet configurator uses authority model');
has(packet, 'summarizeTemplateQuality', 'packet cards show quality summaries');
has(packet, 'data-template-quality', 'packet cards expose quality data attributes');
has(packet, 'await onExhibitsChange(next)', 'exhibit mutations wait for state refresh callback');
has(managerClient, 'ManagerTemplateLibraryStatus', 'manager workspace renders library status summary');
has(managerClient, 'async function handleExhibitsChange() { await loadAssets(round); }', 'manager workspace refetches after exhibit changes');
has(summary, 'data-manager-template-summary="true"', 'library status panel has stable test selector');
has(pkg, 'apply-manager-template-workspace-state-wiring.mjs', 'workspace state wiring runs before dev/typecheck/build');
notHas(managerClient, 'TemplateUploadCard', 'manager workspace client flow has no raw upload card');

checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nManager template authority guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nManager template authority guard passed: ${checks.length} check(s).`);
