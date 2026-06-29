#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const path = 'components/ManagerTemplateWorkspaceClient.tsx';
if (!existsSync(path)) process.exit(0);
const before = readFileSync(path, 'utf8');
let source = before;

source = source.replace("import { defaultReferences, rounds, type LetterReference, type Round } from '../lib/reference-store';", "import { defaultReferences, type LetterReference, type Round } from '../lib/reference-store';");
source = source.replace("import ManagerTemplateLibraryStatus from './ManagerTemplateLibraryStatus';\n", '');
source = source.replace(/\s*<ManagerTemplateLibraryStatus round=\{round\} assets=\{assets\} loading=\{loading\} \/>/g, '');
source = source.replace(
  "  async function handleRemoveLetter() { await loadAssets(round); }\n  async function handleExhibitsChange() { await loadAssets(round); }",
  "  async function handleRemoveLetter() { /* TemplatePacketConfigurator refreshes through onTemplateMutation after delete. */ }\n  async function handleExhibitsHydrated() { /* Hydration does not reload Supabase assets. */ }\n  async function handleTemplateMutation() { await loadAssets(round); }"
);
source = source.replace('onExhibitsChange={handleExhibitsChange}', 'onExhibitsChange={handleExhibitsHydrated} onTemplateMutation={handleTemplateMutation}');

if (!source.includes('merged-template-command')) throw new Error('Merged manager template command is not wired.');
if (source.includes('ManagerTemplateLibraryStatus')) throw new Error('Standalone ManagerTemplateLibraryStatus must not render in merged workspace header.');
if (!source.includes('managerTemplateScope={managerTemplateScope}')) throw new Error('Verified manager template scope is not passed through.');
if (source.includes('canManageTemplates: true')) throw new Error('Fake writable manager template scope fallback remains.');
if (!source.includes('handleExhibitsHydrated')) throw new Error('Managed exhibit hydration callback is not wired.');
if (!source.includes('handleTemplateMutation')) throw new Error('Template mutation refresh callback is not wired.');
if (source.includes('async function handleExhibitsChange() { await loadAssets(round); }')) throw new Error('Hydration still reloads manager assets.');

if (source !== before) {
  writeFileSync(path, source);
  console.log('Applied manager template workspace state wiring.');
} else {
  console.log('Manager template workspace state wiring already present.');
}
