#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) { if (!existsSync(path)) { failures.push(`Missing required file: ${path}`); return ''; } return readFileSync(path, 'utf8'); }
function has(path, term) { const source = read(path); if (source && !source.includes(term)) failures.push(`${path} must include ${term}`); }

[
  'lib/templates/intelligence/dynamic-template-types.ts',
  'lib/templates/intelligence/dynamic-template-inspector.ts',
  'lib/templates/intelligence/dynamic-template-rule-classifier.ts',
  'lib/templates/intelligence/dynamic-template-rule-registry.ts',
  'lib/templates/intelligence/dynamic-template-rule-validation.ts',
  'lib/templates/intelligence/dynamic-template-rule-orchestrator.ts',
  'lib/templates/intelligence/dynamic-template-release-gate.ts',
  'lib/templates/intelligence/dynamic-template-intelligence.ts',
  'lib/templates/intelligence/index.ts',
  'components/templates/workspace/DynamicTemplateDetectionPanel.tsx',
  'components/templates/workspace/DynamicTemplateRuleControlPanel.tsx',
  'components/templates/workspace/DynamicTemplateReleaseGatePanel.tsx',
  'app/api/template-intelligence/inspect/route.ts',
  'app/api/template-intelligence/actions/route.ts',
  'app/api/template-intelligence/actions/[ruleId]/route.ts',
  'supabase/migrations/20260616090000_dynamic_template_intelligence.sql',
  'app/dynamic-template-intelligence.css'
].forEach(read);

has('lib/templates/intelligence/dynamic-template-inspector.ts', 'inspectDynamicTemplateFromAsset');
has('lib/templates/intelligence/dynamic-template-rule-classifier.ts', 'classifyFindingToRule');
has('lib/templates/intelligence/dynamic-template-rule-validation.ts', 'validateDynamicTemplateRule');
has('lib/templates/intelligence/dynamic-template-rule-registry.ts', 'createDynamicTemplateRule');
has('lib/templates/intelligence/dynamic-template-rule-orchestrator.ts', 'buildDynamicTemplateExecutionModel');
has('lib/templates/intelligence/dynamic-template-release-gate.ts', 'assertDynamicTemplateReleaseReady');
has('lib/templates/intelligence/dynamic-template-intelligence.ts', 'inspectAndStoreDynamicTemplate');
has('app/api/template-assets/route.ts', 'inspectAndStoreDynamicTemplate');
has('components/templates/workspace/TemplateStudioHub.tsx', 'DynamicTemplateRuleControlPanel');
has('components/templates/workspace/GenerationEngineHub.tsx', 'DynamicTemplateReleaseGatePanel');
has('app/manager-workspace/studio/page.tsx', 'inspectDynamicTemplateFromAsset');
has('app/manager-workspace/engine/page.tsx', 'buildDynamicTemplateExecutionModel');
has('supabase/migrations/20260616090000_dynamic_template_intelligence.sql', 'dynamic_template_inspections');
has('supabase/migrations/20260616090000_dynamic_template_intelligence.sql', 'dynamic_template_rules');
has('app/layout.tsx', "import './dynamic-template-intelligence.css';");
has('package.json', 'dti:guard');

if (failures.length) {
  console.error('\nDynamic template intelligence guard failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Dynamic template intelligence guard passed.');
