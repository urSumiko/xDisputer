#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function read(path) {
  if (!existsSync(path)) fail(`Missing file: ${path}`);
  return readFileSync(path, 'utf8');
}

execSync('node scripts/apply-manager-template-storage-wiring.mjs', { stdio: 'inherit' });
execSync('node scripts/apply-manager-template-storage-wiring.mjs', { stdio: 'inherit' });
execSync('node scripts/apply-manager-template-generation-wiring.mjs', { stdio: 'inherit' });
execSync('node scripts/apply-manager-template-generation-wiring.mjs', { stdio: 'inherit' });

const fileRoute = read('app/api/template-assets/file/route.ts');
const assetRoute = read('app/api/template-assets/route.ts');
const resolver = read('lib/manager-template-file-resolver.ts');
const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');

if (!fileRoute.includes('): Record<string, string> {')) fail('Template file headers are not typed as Record<string, string>.');
if (!fileRoute.includes("headers['x-template-storage-mode'] = download.mode;")) fail('Template file route does not expose storage mode header.');

const duplicateTemplateStorage = "templateStorage: { mode: managerTemplateStorageMode() }, dynamicTemplateEngineV2: { rendererMode, autoBackfilled: autoBackfill.backfilledCount, warnings: autoBackfill.warnings }, templateStorage: { mode: managerTemplateStorageMode() }";
if (assetRoute.includes(duplicateTemplateStorage)) fail('Duplicate templateStorage payload is still present.');

if (!resolver.includes('canUseLocalTemplateFallback(input?: { canManageTemplates?: boolean | null } | null)')) fail('canUseLocalTemplateFallback does not accept optional manager scope.');
if (!resolver.includes('input?.canManageTemplates')) fail('canUseLocalTemplateFallback does not safely read optional manager scope.');
if (!workspace.includes('canUseLocalTemplateFallback(managerTemplateScope || undefined)')) fail('Workspace no longer matches the guarded fallback call pattern.');

console.log('✅ Manager template type-safety guard passed.');
