#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
function read(path) {
  const ok = existsSync(path);
  checks.push({ ok, label: `file exists: ${path}` });
  return ok ? readFileSync(path, 'utf8') : '';
}
function has(source, term, label) { checks.push({ ok: source.includes(term), label }); }
function notHas(source, term, label) { checks.push({ ok: !source.includes(term), label }); }

console.log('\n=== Manager template roadmap guard ===');
console.log('Verification-only mode: no source-rewrite scripts are executed.');
execSync('node scripts/template-execution-guard.mjs', { stdio: 'inherit' });
execSync('node scripts/template-workspace-contract-guard.mjs', { stdio: 'inherit' });

const managerPage = read('app/manager-workspace/page.tsx');
const templateShell = read('components/templates/workspace/TemplateWorkspaceShell.tsx');
const templateLibraryHub = read('components/templates/workspace/TemplateLibraryHub.tsx');
const managerClient = read('components/ManagerTemplateWorkspaceClient.tsx');
const packet = read('components/TemplatePacketConfigurator.tsx');
const progressive = read('components/TemplateProgressiveWorkspace.tsx');
const authority = read('lib/manager-template-authority.ts');
const resolver = read('lib/manager-template-file-resolver.ts');
const executionResolver = read('lib/template-execution/manager-template-resolver.ts');
const orchestrator = read('lib/template-execution/template-execution-orchestrator.ts');
const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');
const pkg = read('package.json');

has(managerPage, 'TemplateWorkspaceShell', 'manager workspace uses template workspace shell');
has(managerPage, 'TemplateLibraryHub', 'manager workspace uses Template Library source-of-truth hub');
has(managerPage, 'getManagerTemplateLibraryContext', 'manager workspace hydrates template library context');
has(templateShell, 'ManagerConsoleShell', 'template workspace shell delegates to shared manager shell');
has(templateShell, 'templateWorkspaceNavForPath', 'template workspace shell owns three-hub navigation');
has(templateLibraryHub, 'ManagerTemplateWorkspaceClient', 'Template Library hub preserves progressive template flow');
notHas(managerPage, 'TemplateUploadCard', 'manager workspace has no raw upload cards');
notHas(managerPage, 'encType="multipart/form-data"', 'manager workspace has no raw multipart upload forms');

has(managerClient, 'TemplateProgressiveWorkspace', 'manager upload flow reuses progressive client template workflow');
has(managerClient, 'MANAGER_TEMPLATE_ASSET', 'manager upload flow uses manager template source');
has(managerClient, 'managerTemplateScope={managerTemplateScope}', 'manager client passes verified template scope');
notHas(managerClient, 'canManageTemplates: true', 'manager client has no fake writable fallback scope');
has(managerClient, 'handleTemplateMutation', 'manager client reloads assets only after template mutation');

has(packet, 'ManagerTemplateScopeUi', 'packet configurator accepts manager scope');
has(packet, 'canManageTemplates', 'packet configurator gates upload controls');
has(packet, 'resolveTemplateAuthority', 'packet configurator uses authority model');
has(packet, 'onTemplateMutation?.()', 'packet configurator refreshes parent after upload/remove mutation');
notHas(packet, 'template-manager-policy-inline', 'packet configurator does not render duplicate authority banner');

has(progressive, 'data-template-authority-mode', 'progressive template UX exposes authority mode');
has(progressive, 'onTemplateMutation?', 'progressive template UX wires mutation callback');
notHas(progressive, 'template-manager-policy-banner', 'progressive template UX does not render duplicate authority banner');

has(authority, "'CLIENT_READONLY'", 'authority model defines client read-only mode');
has(authority, "'MANAGER_EDIT'", 'authority model defines manager edit mode');
has(resolver, 'resolveManagerTemplateFile', 'legacy-compatible file resolver exists');
has(resolver, 'allowLocalFallback', 'file resolver explicitly controls local fallback');
has(executionResolver, 'class ManagerTemplateResolver', 'template execution resolver owns manager-template selection');
has(executionResolver, 'latestTemplateAssetsBySlot', 'template execution resolver dedupes active slots');
has(orchestrator, 'executeTemplateGeneration', 'TemplateExecutionOrchestrator is the generation entrypoint');
has(orchestrator, 'ManagerTemplateResolver', 'orchestrator resolves manager template authority');
has(orchestrator, 'window.__xdisputerTemplateExecution', 'orchestrator publishes runtime execution snapshot');
has(workspace, 'executeTemplateGeneration({', 'client workspace delegates generation to orchestrator');
notHas(pkg, 'apply-manager-template-generation-wiring.mjs', 'package scripts do not run generation autowrite');
notHas(pkg, 'apply-manager-template-workspace-state-wiring.mjs', 'package scripts do not run workspace-state autowrite');
has(pkg, 'template-execution:guard', 'package uses template execution guard');
has(pkg, 'template-workspace:guard', 'package uses template workspace guard');

checks.forEach((check) => console.log(`${check.ok ? '✅' : '❌'} ${check.label}`));
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nManager template roadmap guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nManager template roadmap guard passed: ${checks.length} check(s).`);
