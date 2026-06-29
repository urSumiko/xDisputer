#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) { if (!existsSync(path)) { failures.push(`Missing required file: ${path}`); return ''; } return readFileSync(path, 'utf8'); }
function has(path, term) { const source = read(path); if (source && !source.includes(term)) failures.push(`${path} must include ${term}`); }
function notHas(path, term) { const source = read(path); if (source && source.includes(term)) failures.push(`${path} must not include ${term}`); }

const manifest = read('lib/console/contracts/navigation-manifest.ts');
const routePage = read('components/console/ConsolePanelRoutePage.tsx');
const renderer = read('components/console/ConsoleTransformationPanel.tsx');
const managerWorkspacePage = read('app/manager-workspace/page.tsx');
const managerWorkspaceChrome = read('components/ManagerTemplateWorkspaceChrome.tsx');
const templateNav = read('lib/templates/workspace/template-workspace-navigation.ts');

for (const term of ['manager-authoring', 'manager-operations', 'master-governance', 'Lifecycle Desk', 'Output Queue', 'Exceptions Desk', 'Capacity Desk', 'Filings Board', 'Policy Studio', 'Entitlements Center', 'Deployment Control', 'Incident Command']) {
  if (!manifest.includes(term)) failures.push(`navigation manifest missing ${term}`);
}

for (const term of ['Template Library', 'Template Studio', 'Generation Engine']) {
  if (!templateNav.includes(term)) failures.push(`template workspace navigation missing ${term}`);
}

for (const path of [
  'app/manager-workspace/studio/page.tsx',
  'app/manager-workspace/engine/page.tsx',
  'app/admin/lifecycle/page.tsx',
  'app/admin/output-queue/page.tsx',
  'app/admin/exceptions/page.tsx',
  'app/admin/capacity/page.tsx',
  'app/admin/filings/page.tsx',
  'app/master/policies/page.tsx',
  'app/master/entitlements/page.tsx',
  'app/master/incidents/page.tsx'
]) read(path);

for (const path of [
  'app/admin/lifecycle/page.tsx',
  'app/admin/output-queue/page.tsx',
  'app/admin/exceptions/page.tsx',
  'app/admin/capacity/page.tsx',
  'app/admin/filings/page.tsx',
  'app/master/policies/page.tsx',
  'app/master/entitlements/page.tsx',
  'app/master/incidents/page.tsx'
]) has(path, 'ConsolePanelRoutePage');

if (!routePage.includes('navItemsForDomain')) failures.push('ConsolePanelRoutePage must use manifest navigation.');
if (!routePage.includes('requireRole')) failures.push('ConsolePanelRoutePage must enforce role access.');
if (!routePage.includes('ManagerConsoleShell')) failures.push('ConsolePanelRoutePage must use shared shell.');
if (!renderer.includes('data-console-panel-id')) failures.push('ConsoleTransformationPanel must expose panel markers.');
notHas('app/manager-workspace/page.tsx', 'id="template-library"');
notHas('app/manager-workspace/page.tsx', 'id="template-health"');
notHas('app/manager-workspace/page.tsx', 'id="template-workflow"');
notHas('app/manager-workspace/page.tsx', 'id="template-upload"');
if (!managerWorkspacePage.includes('TemplateLibraryHub')) failures.push('manager workspace must render TemplateLibraryHub as the source-of-truth hub.');
if (!managerWorkspacePage.includes('TemplateWorkspaceShell')) failures.push('manager workspace must use shared TemplateWorkspaceShell.');
if (!managerWorkspaceChrome.includes('manager-workspace-body-shell')) failures.push('manager workspace chrome must own compact body rhythm.');
if (!managerWorkspaceChrome.includes('min-height: 0 !important')) failures.push('manager workspace chrome must remove oversized template panel min-height.');
if (!managerWorkspaceChrome.includes('template-round-selection-grid')) failures.push('manager workspace chrome must guard round-card grid density.');

if (failures.length) {
  console.error('\nConsole roadmap guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Console roadmap guard passed.');
