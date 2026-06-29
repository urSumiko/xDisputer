#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) { if (!existsSync(path)) { failures.push(`Missing required file: ${path}`); return ''; } return readFileSync(path, 'utf8'); }
function has(path, term) { const source = read(path); if (source && !source.includes(term)) failures.push(`${path} must include ${term}`); }
function notHas(path, term) { const source = read(path); if (source && source.includes(term)) failures.push(`${path} must not include ${term}`); }

[
  'lib/client-template-runtime/client-template-types.ts',
  'lib/client-template-runtime/client-template-context.ts',
  'lib/client-template-runtime/client-template-assignment.ts',
  'lib/client-template-runtime/client-template-source-mapping.ts',
  'lib/client-template-runtime/client-template-rule-application.ts',
  'lib/client-template-runtime/client-template-generation-gate.ts',
  'lib/client-template-runtime/client-template-output-limit.ts',
  'lib/client-template-runtime/client-template-review-packet.ts',
  'lib/client-template-runtime/client-template-supporting-documents.ts',
  'lib/client-template-runtime/client-template-generation-orchestrator.ts',
  'lib/client-template-runtime/index.ts',
  'components/client-template-runtime/ClientTemplateRuntimeDashboard.tsx',
  'components/LetterGeneratorWorkspaceV2.tsx',
  'components/TemplateProgressiveWorkspace.tsx',
  'app/api/client-template-runtime/context/route.ts',
  'app/api/client-template-runtime/generate/route.ts',
  'app/client-template-runtime.css'
].forEach(read);

has('app/workspace/page.tsx', 'LetterGeneratorWorkspaceV2');
notHas('app/workspace/page.tsx', 'ClientTemplateRuntimeDashboard');
notHas('app/workspace/page.tsx', 'getClientTemplateRuntimeContext');
has('components/TemplateProgressiveWorkspace.tsx', 'onUseRoundForSourceData');
has('components/TemplateProgressiveWorkspace.tsx', 'Use selected template for Source Data');
has('components/TemplateProgressiveWorkspace.tsx', 'data-client-template-source-handoff');
has('components/LetterGeneratorWorkspaceV2.tsx', 'registryAssets');
has('components/LetterGeneratorWorkspaceV2.tsx', 'effectiveRefs');
has('components/LetterGeneratorWorkspaceV2.tsx', 'effectiveTemplates');
has('components/LetterGeneratorWorkspaceV2.tsx', 'executeTemplateGeneration');
has('components/LetterGeneratorWorkspaceV2.tsx', 'onUseRoundForSourceData');
has('lib/client-template-runtime/client-template-context.ts', 'loadEnabledDynamicTemplateRules');
has('lib/client-template-runtime/client-template-rule-application.ts', 'applyManagerRulesToClientData');
has('lib/client-template-runtime/client-template-generation-gate.ts', 'assertClientCanGenerate');
has('lib/client-template-runtime/client-template-generation-orchestrator.ts', 'generateClientLettersFromManagerTemplate');
has('app/api/client-template-runtime/generate/route.ts', 'generateClientLettersFromManagerTemplate');
has('app/layout.tsx', "import './client-template-runtime.css';");
has('app/layout.tsx', "import './final-responsive-integrity.css';");
has('lib/ui-intelligence/registry.ts', 'client-template-handoff');
has('package.json', 'client-template:guard');

if (failures.length) {
  console.error('\nClient template runtime guard failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Client template runtime guard passed.');
