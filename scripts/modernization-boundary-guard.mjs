#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const requiredFiles = [
  'docs/modernization-implementation-tracker.md',
  'docs/modernization-boundary-contract.md',
  'src/features/README.md',
  'src/features/auth/README.md',
  'src/features/accounts/README.md',
  'src/features/templates/README.md',
  'src/features/source-data/README.md',
  'src/features/source-data/source-readiness.ts',
  'src/features/generation/README.md',
  'src/features/generation/readiness.ts',
  'src/features/generation/components/WorkflowRail.tsx',
  'src/features/outputs/README.md',
  'src/features/evidence/README.md',
  'src/features/notifications/README.md',
  'src/features/admin/README.md',
  'src/features/admin/modernization-status-client.ts',
  'src/server/README.md',
  'src/server/auth/README.md',
  'src/server/contracts/service-result.ts',
  'src/server/contracts/validated-input.ts',
  'src/server/contracts/modernization-readiness.ts',
  'src/server/http/api-response.ts',
  'src/server/policies/README.md',
  'src/server/repositories/README.md',
  'src/server/services/README.md',
  'src/server/services/modernization-status.ts',
  'scripts/modernization-dependency-sync.mjs',
  'scripts/performance-modernization-guard.mjs',
  'app/api/system/modernization/route.ts'
];

let failed = false;

function report(message) {
  failed = true;
  console.error(`modernization-boundary-guard: ${message}`);
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

for (const file of requiredFiles) {
  if (!existsSync(file)) report(`missing ${file}`);
}

const tracker = read('docs/modernization-implementation-tracker.md');
for (const marker of ['Coded in this pass', 'Not coded yet', 'Next safe coding order', 'Tracking rule', '10x smooth UI and performance strategy']) {
  if (!tracker.includes(marker)) report(`tracker marker missing: ${marker}`);
}

const boundary = read('docs/modernization-boundary-contract.md');
for (const marker of ['Routes', 'Services', 'Repositories', 'Policies', 'Features', 'Styling']) {
  if (!boundary.includes(marker)) report(`boundary marker missing: ${marker}`);
}

const serviceResult = read('src/server/contracts/service-result.ts');
for (const marker of ['ServiceResult', 'serviceSuccess', 'serviceFailure']) {
  if (!serviceResult.includes(marker)) report(`service result marker missing: ${marker}`);
}

const apiResponse = read('src/server/http/api-response.ts');
for (const marker of ['jsonFromServiceResult', 'jsonOk', 'Cache-Control']) {
  if (!apiResponse.includes(marker)) report(`HTTP helper marker missing: ${marker}`);
}

const route = read('app/api/system/modernization/route.ts');
for (const marker of ['jsonFromServiceResult', 'readModernizationStatus']) {
  if (!route.includes(marker)) report(`route marker missing: ${marker}`);
}

const sourceFlow = read('components/GuidedSourceDataFlow.tsx');
for (const marker of ['WorkflowRail', 'workflowActiveStep']) {
  if (!sourceFlow.includes(marker)) report(`source workflow marker missing: ${marker}`);
}

if (!read('src/features/generation/components/WorkflowRail.tsx').includes('data-modernization-feature="generation"')) {
  report('workflow rail feature marker missing');
}

try {
  execSync('node scripts/performance-modernization-guard.mjs', { stdio: 'inherit' });
} catch {
  report('performance modernization guard failed');
}

if (failed) process.exit(1);
console.log('modernization-boundary-guard: ok');
