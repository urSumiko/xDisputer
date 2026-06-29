import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const failures = [];

const requiredFiles = [
  'lib/ai/ai-ui-result.ts',
  'lib/ai/ai-ui-client.ts',
  'components/AiInsightPanel.tsx',
  'components/SourceReviewAiPanel.tsx',
  'components/TemplateIntelligencePanel.tsx',
  'components/GuidedSourceDataFlow.tsx',
  'components/TemplateProgressiveWorkspace.tsx',
  'docs/ai-ui-wiring-canvas.md'
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing AI UI wiring file: ${file}`);
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function assertIncludes(file, needle, message) {
  if (!read(file).includes(needle)) failures.push(message);
}

if (!failures.length) {
  assertIncludes('lib/ai/ai-types.ts', "'source_review'", 'AI modes must include source_review.');
  assertIncludes('lib/ai/ai-types.ts', "'template_intelligence'", 'AI modes must include template_intelligence.');
  assertIncludes('lib/ai/ai-ui-result.ts', 'export type AiUiResult', 'AI UI result contract must be exported.');
  assertIncludes('lib/ai/ai-ui-result.ts', 'replace(/<[^>]*>/g', 'AI UI text must strip HTML-like tags before rendering.');
  assertIncludes('lib/ai/ai-ui-client.ts', "fetch('/api/ai'", 'AI UI client must call the existing /api/ai route.');

  const insight = read('components/AiInsightPanel.tsx');
  if (insight.includes('dangerouslySetInnerHTML')) failures.push('AI UI must not render model text with dangerouslySetInnerHTML.');

  const source = read('components/GuidedSourceDataFlow.tsx');
  if (!source.includes('SourceReviewAiPanel')) failures.push('Source Data workflow must render SourceReviewAiPanel.');
  if (!source.includes('generation-blocked-reasons')) failures.push('Source Data workflow must keep visible generation blocker reasons.');
  if (!source.includes('disabled={busy || !packetReady}')) failures.push('Generate button must stay disabled until deterministic packetReady is true.');

  const template = read('components/TemplateProgressiveWorkspace.tsx');
  if (!template.includes('TemplateIntelligencePanel')) failures.push('Templates workflow must render TemplateIntelligencePanel.');
  if (read('components/TemplateIntelligencePanel.tsx').includes('onUploadLetter(') || read('components/TemplateIntelligencePanel.tsx').includes('onRemoveLetter(')) {
    failures.push('Template Intelligence panel must not mutate template assets.');
  }
}

if (failures.length) {
  console.error('AI UI contract guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}

console.log('AI UI contract guard passed.');
