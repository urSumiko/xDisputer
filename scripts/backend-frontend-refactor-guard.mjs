#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push('missing ' + path), '');
const must = (source, marker, label) => { if (!source.includes(marker)) failures.push(label); };

const canvas = read('docs/roadmaps/backend-frontend-refactor-canvas.md');
const contract = read('src/features/architecture/backend-frontend-refactor-contract.ts');
const guardRegistry = read('src/features/architecture/ui-guard-contract-registry.ts');
const rootCssContract = read('src/features/app-shell/root-css-ownership-contract.ts');
const figmaHandoff = read('src/features/design/figma-surface-handoff.ts');
const generationContract = read('src/features/generation-runs/generation-run-route-contract.ts');

for (const marker of [
  '## B1. Generation route is too large and mixes multiple responsibilities',
  '## B2. Manager payroll save flow still owns business rules inside the route',
  '## B3. Account profile route has route-local revalidation ownership',
  '## B4. Backend feature boundaries are inconsistent between',
  '## B5. SQL and schema traceability is still document-light for feature changes'
]) must(canvas, marker, 'canvas missing backend marker: ' + marker);

for (const marker of [
  '## F1. Root CSS ownership is still too global',
  '## F2. Admin page still mixes data shaping and UI composition',
  '## F3. Components and features are still split across two ownership trees',
  '## F4. Manager/master/client surface contracts are not yet unified into a UI handoff map',
  '## F5. Popover, workflow, and card geometry are still validated mainly by guards instead of dedicated UI contracts'
]) must(canvas, marker, 'canvas missing frontend marker: ' + marker);

must(canvas, 'node scripts/backend-frontend-refactor-guard.mjs', 'canvas must expose verification command');
must(contract, 'backendRefactorProblems', 'contract must declare backend refactor problems');
must(contract, 'frontendRefactorProblems', 'contract must declare frontend refactor problems');
must(contract, 'backendCount: backendRefactorProblems.length', 'contract must expose backend count');
must(contract, 'frontendCount: frontendRefactorProblems.length', 'contract must expose frontend count');
must(guardRegistry, 'uiGuardContractRegistry', 'guard registry must exist');
must(rootCssContract, 'rootCssOwnershipContract', 'root CSS ownership contract must exist');
must(figmaHandoff, 'figmaSurfaceHandoff', 'Figma handoff map must exist');
must(generationContract, 'generationRunRouteContract', 'generation route contract must exist');

if (!existsSync('src/features/manager-console/payroll-settings-service.ts')) failures.push('manager payroll settings service must exist');
if (!existsSync('src/features/account-profile/account-profile-revalidation.ts')) failures.push('account profile revalidation helper must exist');
if (!existsSync('src/features/manager-console/admin-page-presenters.ts')) failures.push('admin page presenters helper must exist');

if (failures.length) {
  console.error('backend-frontend-refactor-guard failed: ' + failures.length + ' check(s).');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('backend-frontend-refactor-guard: ok');
