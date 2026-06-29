#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'lib/frontend-control/account-scope.ts',
  'lib/frontend-control/action-registry.ts',
  'lib/frontend-control/content-registry.ts',
  'lib/frontend-control/identity-registry.ts',
  'lib/frontend-control/layout-registry.ts',
  'lib/frontend-control/navigation-map.ts',
  'lib/frontend-control/performance-profile.ts',
  'lib/frontend-control/resolve-control.ts',
  'lib/frontend-control/index.ts',
  'lib/design-system/tokens.ts',
  'lib/design-system/variants.ts',
  'docs/frontend-command-architecture-canvas.md'
];

let failed = false;

function markFailure(message) {
  failed = true;
  console.error(`frontend-control-guard: ${message}`);
}

function readFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

for (const file of requiredFiles) {
  if (!existsSync(file)) markFailure(`missing ${file}`);
}

const identitySource = readFile('lib/frontend-control/identity-registry.ts');
for (const identity of ['action.primary', 'table.directory', 'panel.template', 'workspace.frame']) {
  if (!identitySource.includes(identity)) markFailure(`identity registry missing ${identity}`);
}

const contentSource = readFile('lib/frontend-control/content-registry.ts');
for (const key of ['global.loading', 'actions.save', 'actions.finalize']) {
  if (!contentSource.includes(key)) markFailure(`content registry missing ${key}`);
}

const actionSource = readFile('lib/frontend-control/action-registry.ts');
for (const action of ['click.feedback', 'pending.guard', 'refresh.manual']) {
  if (!actionSource.includes(action)) markFailure(`action registry missing ${action}`);
}

if (failed) process.exit(1);
console.log('frontend-control-guard: ok');
