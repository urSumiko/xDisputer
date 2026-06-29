import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function requireFile(path) {
  if (!existsSync(join(root, path))) failures.push(`Missing file: ${path}`);
}

function requireIncludes(path, value, message) {
  if (!read(path).includes(value)) failures.push(message);
}

requireFile('app/ui-collapse-recovery.css');
requireFile('app/layout.tsx');

if (!failures.length) {
  const layout = read('app/layout.tsx');
  const recoveryImport = "import './ui-collapse-recovery.css';";
  const clientLockImport = "import './client-workspace-layout-lock.css';";

  if (!layout.includes(recoveryImport)) failures.push('layout.tsx must import ui-collapse-recovery.css.');
  if (layout.indexOf(recoveryImport) < layout.indexOf(clientLockImport)) failures.push('ui-collapse-recovery.css must import after client-workspace-layout-lock.css.');

  const css = read('app/ui-collapse-recovery.css');
  const requiredSelectors = [
    '.support-layout-grid.word-crop-grid',
    'grid-template-areas: "evidence preview controls"',
    '.word-left-evidence-manager',
    '.source-stage-actions',
    '.directory-filter-form',
    '.directory-header-action',
    '.admin-monitor-brand',
    '.app-shell .brand'
  ];

  for (const selector of requiredSelectors) {
    if (!css.includes(selector)) failures.push(`ui-collapse-recovery.css missing selector/contract: ${selector}`);
  }

  requireIncludes('components/SupportingDocumentsLayoutEditor.tsx', 'word-left-evidence-manager', 'Evidence manager slot must exist in SupportingDocumentsLayoutEditor.');
  requireIncludes('components/GuidedSourceDataFlow.tsx', 'disabled={busy || !packetReady}', 'Generate button must remain controlled by deterministic packetReady.');
  requireIncludes('app/master/accounts/page.tsx', 'single-header-dataset', 'Master account directory must use the single-header dataset wrapper.');
}

if (failures.length) {
  console.error('UI collapse contract guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}

console.log('UI collapse contract guard passed.');
