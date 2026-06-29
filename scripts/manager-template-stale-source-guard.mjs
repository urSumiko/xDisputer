#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function assertFile(path) {
  if (!existsSync(path)) fail(`Missing file: ${path}`);
  return readFileSync(path, 'utf8');
}

execSync('node scripts/apply-manager-template-generation-wiring.mjs', { stdio: 'inherit' });
execSync('node scripts/apply-manager-template-generation-wiring.mjs', { stdio: 'inherit' });

const workspace = assertFile('components/LetterGeneratorWorkspaceV2.tsx');

if (!workspace.includes('resolveManagerTemplateFile')) fail('Generation workspace does not call resolveManagerTemplateFile.');
if (!workspace.includes('MANAGER_TEMPLATE_ASSET')) fail('Generation workspace does not mark templates as MANAGER_TEMPLATE_ASSET.');
if (workspace.includes("source: 'SUPABASE_TEMPLATE_ASSET'")) fail('Old SUPABASE_TEMPLATE_ASSET source marker remains.');
if (!workspace.includes('managerTemplateScope')) fail('Generation workspace does not track managerTemplateScope.');
if (!workspace.includes('setManagerTemplateScope(payload.managerTemplateScope || null)')) fail('Generation workspace does not store manager template scope from API payload.');
if (!workspace.includes('managerTemplateScope={managerTemplateScope} managedExhibits={effectiveTemplates}')) fail('Template UI does not receive manager scope and effective manager exhibits.');
if (!workspace.includes('!effectiveRefs.find((item) => item.type === type)?.file')) fail('Missing-letter check does not use effective manager references.');

console.log('✅ Manager template stale-source guard passed.');
