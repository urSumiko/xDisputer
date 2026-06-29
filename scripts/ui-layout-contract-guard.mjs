#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const failures = [];

function read(path) {
  const full = join(root, path);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${path}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function must(path, text, message) {
  if (!read(path).includes(text)) failures.push(message);
}

function mustNot(path, text, message) {
  if (read(path).includes(text)) failures.push(message);
}

function mustAny(paths, text, message) {
  if (!paths.some((path) => read(path).includes(text))) failures.push(message);
}

must('app/layout.tsx', "import './ui-layout-contracts.css';", 'Root layout must import final UI layout contracts.');
must('app/layout.tsx', "import './ui-collapse-recovery.css';", 'Root layout must keep collapse recovery before final contracts.');

const layout = read('app/layout.tsx');
if (layout.includes("import './ui-layout-contracts.css';") && layout.includes("import './ui-collapse-recovery.css';") && layout.indexOf("import './ui-layout-contracts.css';") < layout.indexOf("import './ui-collapse-recovery.css';")) {
  failures.push('ui-layout-contracts.css must load after ui-collapse-recovery.css.');
}

must('app/ui-layout-contracts.css', '[data-layout-contract="supporting-documents-editor"]', 'Supporting Documents editor data contract selector missing.');
must('app/ui-layout-contracts.css', '.support-layout-grid.word-crop-grid', 'Supporting Documents existing class contract missing.');
must('app/ui-layout-contracts.css', 'grid-template-areas: "evidence preview controls"', 'Desktop Evidence | Preview | Controls grid missing.');
must('app/ui-layout-contracts.css', '"preview controls"', 'Tablet Preview | Controls row missing.');
must('app/ui-layout-contracts.css', '"evidence evidence"', 'Tablet Evidence row missing.');
must('app/ui-layout-contracts.css', '"preview"', 'Mobile Preview first contract missing.');
must('app/ui-layout-contracts.css', '"controls"', 'Mobile Controls second contract missing.');
must('app/ui-layout-contracts.css', '"evidence"', 'Mobile Evidence final contract missing.');
must('app/ui-layout-contracts.css', '[data-layout-contract="command-header"]', 'Command header contract selector missing.');
must('app/ui-layout-contracts.css', '[data-layout-contract="dataset-card"]', 'Dataset card contract selector missing.');
must('app/ui-layout-contracts.css', '[data-layout-contract="console-sidebar"]', 'Console sidebar contract selector missing.');
must('app/ui-layout-contracts.css', '.directory-filter-form', 'Directory filter toolbar contract missing.');
must('app/ui-layout-contracts.css', '.access-workflow-grid', 'Account overview dataset grid contract missing.');

must('components/SupportingDocumentsLayoutEditor.tsx', 'support-layout-grid word-crop-grid', 'Supporting editor must still render the grid owner.');
must('components/SupportingDocumentsLayoutEditor.tsx', 'word-left-evidence-manager', 'Supporting editor must still render Evidence files zone.');
must('components/SupportingDocumentsLayoutEditor.tsx', 'support-page-frame', 'Supporting editor must still render Preview zone.');
must('components/SupportingDocumentsLayoutEditor.tsx', 'support-layout-controls word-crop-controls', 'Supporting editor must still render Controls zone.');

mustAny(['components/GuidedSourceDataFlow.tsx', 'app/master/accounts/page.tsx'], 'data-layout-contract="command-header"', 'At least one command header must declare the explicit command contract.');
must('components/GuidedSourceDataFlow.tsx', 'disabled={busy || !packetReady}', 'Generate must remain controlled by deterministic packetReady.');
must('components/GuidedSourceDataFlow.tsx', 'generation-blocked-reasons', 'Visible generation blocker panel must remain.');

must('app/master/accounts/page.tsx', 'data-layout-contract="dataset-card"', 'Master account directory must declare the dataset card contract.');
must('app/master/accounts/page.tsx', 'data-layout-zone="dataset-toolbar"', 'Master account directory toolbar zone missing.');
must('app/master/accounts/page.tsx', 'data-layout-zone="dataset-pagination"', 'Master account directory pagination zone missing.');
must('components/console/ConsoleShell.tsx', 'data-layout-contract="console-sidebar"', 'Console sidebar must declare sidebar contract.');

mustNot('app/ui-layout-contracts.css', 'width:1600px', 'No fixed wide page width allowed.');
mustNot('app/ui-layout-contracts.css', 'min-width:1200px', 'No fixed desktop minimum width allowed.');

if (failures.length) {
  console.error('UI layout contract guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}

console.log('UI layout contract guard passed.');
