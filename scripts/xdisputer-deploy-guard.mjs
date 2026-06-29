import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function run(command) {
  console.log(`\n▶ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function assertFile(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  console.log(`✅ ${path}`);
}

function assertContains(path, text) {
  const file = readFileSync(path, 'utf8');
  if (!file.includes(text)) throw new Error(`Missing required code in ${path}: ${text}`);
  console.log(`✅ ${path} contains ${text}`);
}

console.log('\n=== xDisputer repo guard: Codespaces + Supabase mode ===');

assertFile('components/console/ConsoleShell.tsx');
assertFile('components/console/ConsoleHeader.tsx');
assertFile('components/console/AccountMenu.tsx');
assertFile('components/console/RenderDebugger.tsx');
assertFile('app/console-shell-system.css');
assertFile('app/console-debug-overlay.css');
assertFile('scripts/console-shell-contract-guard.mjs');
assertFile('docs/ui-shell-roadmap-tracker.md');
assertFile('lib/round-template-policy.ts');
assertFile('lib/generation-manifest.ts');
assertFile('lib/supabase/template-registry.ts');
assertFile('lib/readiness-checklist-control.ts');
assertFile('scripts/readiness-checklist-disabled-guard.mjs');
assertFile('lib/dynamic-template/field-registry.ts');
assertFile('lib/dynamic-template/contract-v2.ts');
assertFile('lib/dynamic-template/mapping-engine.ts');
assertFile('lib/dynamic-template/docx-layout-renderer-v2.ts');
assertFile('lib/dynamic-template/render-validation.ts');
assertFile('lib/dynamic-template/renderer-mode.ts');
assertFile('app/api/template-assets/route.ts');
assertFile('app/api/template-assets/file/route.ts');
assertFile('app/api/system/runtime/route.ts');
assertFile('app/system/runtime/page.tsx');
assertFile('app/system/templates/page.tsx');

assertContains('components/console/ConsoleShell.tsx', 'data-console-shell="true"');
assertContains('components/console/ConsoleShell.tsx', '<ConsoleHeader');
assertContains('components/console/ConsoleShell.tsx', '<AccountMenu');
assertContains('components/console/RenderDebugger.tsx', 'window.__xdisputerDebug');
assertContains('app/account-menu-ratio-system.css', "@import './console-shell-system.css';");
assertContains('components/ManagerConsoleShell.tsx', '<ConsoleShell');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', '/api/template-assets?round=');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', '/api/template-assets/file?');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', 'generation-manifest.json');
assertContains('components/LetterGeneratorWorkspaceV2.tsx', 'buildGenerationManifest');
assertContains('app/api/template-assets/route.ts', 'autoBackfillDynamicTemplateV2');
assertContains('lib/dynamic-template/docx-layout-renderer-v2.ts', 'DOCX_LAYOUT_RENDERER_V2');
assertContains('lib/dynamic-template/render-validation.ts', 'scanUnresolvedPlaceholders');
assertContains('lib/readiness-checklist-control.ts', 'READINESS_CHECKLIST_DISABLED = true');
assertContains('components/GenerationPreflightChecklist.tsx', 'if (READINESS_CHECKLIST_DISABLED) return null');
assertContains('lib/preflight-validation.ts', 'DISABLED_PREFLIGHT_RESULT');

run('node scripts/phase14-local-safety-check.mjs');
run('npm run ui-source:guard');
run('node scripts/readiness-checklist-disabled-guard.mjs');
run('npm run dynamic-template:v2:regression');
run('npm run typecheck');
run('npm run build');

console.log('\n✅ Repo guard passed. Codespaces and Supabase source checks are synchronized.');
