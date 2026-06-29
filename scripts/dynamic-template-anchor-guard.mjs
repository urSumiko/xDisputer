#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) {
  if (!existsSync(path)) {
    failures.push(`Missing required file: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}
function has(path, term) {
  const source = read(path);
  if (source && !source.includes(term)) failures.push(`${path} must include ${term}`);
}
function notHas(path, term) {
  const source = read(path);
  if (source && source.includes(term)) failures.push(`${path} must not include ${term}`);
}

[
  'lib/dynamic-template-intelligence/anchor-alias-registry.ts',
  'lib/dynamic-template-intelligence/docx-structure-reader.ts',
  'lib/dynamic-template-intelligence/semantic-section-detector.ts',
  'lib/dynamic-template-intelligence/insertion-zone-resolver.ts',
  'lib/dynamic-template-intelligence/template-rule-store.ts',
  'lib/dynamic-template-intelligence/template-contract-validator.ts',
  'lib/dynamic-template-intelligence/template-diff-analyzer.ts',
  'lib/dynamic-template-intelligence/generation-repair-planner.ts',
  'lib/dynamic-template-intelligence/docx-paragraph-inserter.ts',
  'lib/dynamic-template-intelligence/template-version-policy.ts',
  'lib/dynamic-template-intelligence/index.ts',
  'lib/ui-intelligence/dynamic-template-anchor-contract.ts',
  'supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql'
].forEach(read);

has('lib/dynamic-template-intelligence/anchor-alias-registry.ts', 'TEMPLATE_ANCHOR_ALIAS_REGISTRY');
has('lib/dynamic-template-intelligence/anchor-alias-registry.ts', 'FRAUDULENT ACCOUNTS FOR IMMEDIATE BLOCKING AND DELETION');
has('lib/dynamic-template-intelligence/anchor-alias-registry.ts', 'ACCOUNT NAME:');
has('lib/dynamic-template-intelligence/docx-structure-reader.ts', 'readDocxStructure');
has('lib/dynamic-template-intelligence/docx-structure-reader.ts', 'word/document.xml');
has('lib/dynamic-template-intelligence/docx-structure-reader.ts', 'bookmarkNames');
has('lib/dynamic-template-intelligence/docx-structure-reader.ts', 'contentControlTags');
has('lib/dynamic-template-intelligence/semantic-section-detector.ts', 'detectTemplateAnchors');
has('lib/dynamic-template-intelligence/semantic-section-detector.ts', 'paragraph-pattern');
has('lib/dynamic-template-intelligence/insertion-zone-resolver.ts', 'resolveInsertionZone');
has('lib/dynamic-template-intelligence/insertion-zone-resolver.ts', 'append-before-signature');
has('lib/dynamic-template-intelligence/generation-repair-planner.ts', 'ANCHOR_REPAIR_REQUIRED');
has('lib/dynamic-template-intelligence/template-contract-validator.ts', 'validateDynamicDocxAnchorContract');
has('lib/dynamic-template-intelligence/template-diff-analyzer.ts', 'removed-anchor');
has('lib/dynamic-template-intelligence/template-version-policy.ts', 'accept-with-repair');
has('lib/docx-anchor-binder.ts', 'anchorPolicy');
has('lib/docx-anchor-binder.ts', 'inventWhenMissing');
has('lib/ui-message-contract.ts', 'TEMPLATE_ANCHOR_REPAIR_REQUIRED');
has('lib/ui-message-contract.ts', 'Template needs anchor mapping');
has('lib/ui-intelligence/dynamic-template-anchor-contract.ts', 'dynamic-template-anchor-intelligence');
has('lib/ui-intelligence/dynamic-template-anchor-contract.ts', 'template_anchor_rules');
has('lib/ui-intelligence/index.ts', 'dynamicTemplateAnchorIntelligenceContract');
has('supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql', 'template_anchor_rules');
has('supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql', 'template_validation_events');
has('supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql', 'enable row level security');
has('package.json', 'dynamic-template:anchor-guard');
notHas('lib/docx-anchor-binder.ts', "inventWhenMissing: false");

if (failures.length) {
  console.error('\nDynamic template anchor guard failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Dynamic template anchor guard passed.');
