#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';

const contracts = [
  { id: 'console-shell', label: 'Console Shell', scope: 'global', files: ['components/console/ConsoleShell.tsx', 'app/final-console-account-rail.css'], markers: ['data-console-shell="true"', 'data-console-layout-ratio="75/25"', 'data-console-mode-switch="sidebar-bottom"'] },
  { id: 'account-menu', label: 'Account Settings Rail', scope: 'global', files: ['components/console/AccountMenu.tsx', 'app/api/account/profile/route.ts'], markers: ['data-console-account-menu="true"', 'data-manager-account-popover-align="same-rail"', 'manager-account-settings-form'] },
  { id: 'render-debugger', label: 'Render Debugger', scope: 'global', files: ['components/console/RenderDebugger.tsx'], markers: ['window.__xdisputerDebug', 'headerAccountWidthRatio', 'detectionMode'] },
  { id: 'template-execution', label: 'Template Execution Contract', scope: 'domain', files: ['components/ManagerTemplateWorkspaceClient.tsx', 'scripts/template-execution-guard.mjs'], markers: ['template'] }
];

function read(path) {
  if (!existsSync(path) || statSync(path).isDirectory()) return '';
  return readFileSync(path, 'utf8');
}

console.log('UI Intelligence Report');
console.log(`Generated: ${new Date().toISOString()}`);
console.log('');

contracts.forEach((contract) => {
  const source = contract.files.map(read).join('\n');
  const missingFiles = contract.files.filter((file) => !existsSync(file));
  const missingMarkers = contract.markers.filter((marker) => !source.includes(marker));
  const status = missingFiles.length || missingMarkers.length ? 'warning' : 'healthy';
  console.log(`${status === 'healthy' ? '✅' : '⚠️'} ${contract.id} (${contract.scope}) — ${contract.label}`);
  if (missingFiles.length) console.log(`  Missing files: ${missingFiles.join(', ')}`);
  if (missingMarkers.length) console.log(`  Missing markers: ${missingMarkers.join(', ')}`);
});

console.log('');
console.log('Propagation groups');
console.log('- console-global: console-shell, account-menu, sidebar-switch-mode, render-debugger');
console.log('- template-domain: template-execution, parser, canonical fields, renderer, generation engine');
console.log('');
console.log('Root-cause workflow');
console.log('1. Check route layout wrapper.');
console.log('2. Check ConsoleShell markers.');
console.log('3. Check final CSS rail and loaded CSS bundle.');
console.log('4. Check API/RPC/function dependency.');
console.log('5. Clear .next and verify with runtime debugger.');
