#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const failures = [];

function run(command) {
  console.log(`\n▶ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function sourceOf(path) {
  if (!existsSync(path)) {
    failures.push(`Missing file: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function assertContains(path, term, label) {
  const source = sourceOf(path);
  if (source && !source.includes(term)) failures.push(`${label}: missing ${term} in ${path}`);
  else if (source) console.log(`✅ ${label}`);
}

function assertNotContains(path, term, label) {
  const source = sourceOf(path);
  if (source && source.includes(term)) failures.push(`${label}: forbidden ${term} in ${path}`);
  else if (source) console.log(`✅ ${label}`);
}

console.log('\n=== Manager local dev readiness: verification-only ===');
assertContains('app/admin/page.tsx', 'ManagerConsoleShell', '/admin uses shared manager shell');
assertContains('app/admin/page.tsx', 'mode="operations"', '/admin is operations mode');
assertNotContains('app/admin/page.tsx', "import ManagerWorkspaceSwitch from '../../components/ManagerWorkspaceSwitch';", '/admin has no stale direct switch import after shell migration');
assertContains('app/admin/access/page.tsx', 'ManagerWorkspaceSwitch', '/admin/access is switch-ready');
assertContains('components/AccessAuditView.tsx', 'ManagerWorkspaceSwitch', '/admin/audit is switch-ready');
assertContains('components/GenerationReportView.tsx', 'ManagerWorkspaceSwitch', '/admin/reports is switch-ready');
assertContains('app/manager-workspace/page.tsx', 'ManagerConsoleShell', '/manager-workspace uses shared shell');
assertContains('app/manager-workspace/page.tsx', 'ManagerTemplateWorkspaceClient', '/manager-workspace uses client-style upload workflow');
assertNotContains('app/manager-workspace/page.tsx', 'TemplateUploadCard', '/manager-workspace has no raw upload cards');
assertNotContains('app/manager-workspace/page.tsx', 'encType="multipart/form-data"', '/manager-workspace has no raw upload forms');
assertContains('components/ManagerTemplateWorkspaceClient.tsx', 'TemplateProgressiveWorkspace', 'manager upload workflow reuses client progressive workflow');
assertContains('components/ManagerTemplateWorkspaceClient.tsx', 'ManagerTemplateLibraryStatus', 'manager workspace shows active template summary');
assertContains('components/ManagerTemplateWorkspaceClient.tsx', 'async function handleExhibitsChange() { await loadAssets(round); }', 'manager workspace refetches after exhibit mutation');
assertContains('components/TemplatePacketConfigurator.tsx', 'resolveTemplateAuthority', 'template configurator uses authority model');
assertContains('components/TemplatePacketConfigurator.tsx', 'summarizeTemplateQuality', 'template cards show quality summary');
assertContains('components/TemplateProgressiveWorkspace.tsx', 'data-template-authority-mode', 'progressive UX exposes authority mode');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', 'resolveManagerTemplateFile', 'generation uses manager template resolver');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', 'MANAGER_TEMPLATE_ASSET', 'generation tracks manager template source');

if (failures.length) {
  console.error('\nManager local dev readiness failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

run('node scripts/manager-workspace-guard.mjs');
run('node scripts/manager-template-roadmap-guard.mjs');
console.log('\n✅ Manager local dev UI is ready. Restart dev and open /admin or /manager-workspace on port 3000.');
