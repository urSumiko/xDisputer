#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function assertFile(path) {
  const ok = existsSync(path);
  checks.push({ ok, label: `file exists: ${path}` });
  return ok ? readFileSync(path, 'utf8') : '';
}

function assertIncludes(content, needle, label) {
  checks.push({ ok: content.includes(needle), label });
}

function assertNotIncludes(content, needle, label) {
  checks.push({ ok: !content.includes(needle), label });
}

const registry = assertFile('lib/dynamic-template/field-registry.ts');
const contract = assertFile('lib/dynamic-template/contract-v2.ts');
const mapping = assertFile('lib/dynamic-template/mapping-engine.ts');
const renderer = assertFile('lib/dynamic-template/docx-layout-renderer-v2.ts');
const validation = assertFile('lib/dynamic-template/render-validation.ts');
const quality = assertFile('lib/dynamic-template/quality-framework.ts');
const advancedZones = assertFile('lib/dynamic-template/advanced-zone-policy.ts');
const orchestrator = assertFile('lib/dynamic-template/render-orchestrator.ts');
const appendixBridge = assertFile('lib/dynamic-template/appendix-renderer-v2-bridge.ts');
const rendererMode = assertFile('lib/dynamic-template/renderer-mode.ts');
const uploadRoute = assertFile('app/api/template-assets/route.ts');
const readinessControl = assertFile('lib/readiness-checklist-control.ts');
const preflight = assertFile('lib/preflight-validation.ts');
const supplemental = assertFile('lib/supplemental-template-renderer.ts');
const ftcWorkflow = assertFile('lib/ftc-workflow.ts');
const anchorRegistry = assertFile('lib/dynamic-template-intelligence/anchor-alias-registry.ts');
const structureReader = assertFile('lib/dynamic-template-intelligence/docx-structure-reader.ts');
const sectionDetector = assertFile('lib/dynamic-template-intelligence/semantic-section-detector.ts');
const zoneResolver = assertFile('lib/dynamic-template-intelligence/insertion-zone-resolver.ts');
const anchorValidator = assertFile('lib/dynamic-template-intelligence/template-contract-validator.ts');
const repairPlanner = assertFile('lib/dynamic-template-intelligence/generation-repair-planner.ts');
const anchorMigration = assertFile('supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql');

for (const term of ['DISPUTE_LETTER', 'LATE_PAYMENT_LETTER', 'AFFIDAVIT', 'FTC', 'FCRA', 'ATTACHMENT']) {
  assertIncludes(registry, term, `field registry covers ${term}`);
}

for (const term of ['client.name', 'client.addressLines', 'letter.date', 'bureau.name', 'accounts.dispute', 'accounts.latePayments', 'affidavit.state', 'affidavit.county', 'ftc.reportNumber', 'ftc.statement']) {
  assertIncludes(registry, term, `canonical field exists: ${term}`);
}

for (const term of ['TABLE_ROW_PROTOTYPE', 'HEADER', 'FOOTER', 'unsupportedZones', 'missingFields', 'unknownPlaceholders']) {
  assertIncludes(contract, term, `contract-v2 detects ${term}`);
}

for (const term of ['INLINE_REPLACE', 'MULTILINE_REPLACE', 'REPEAT_BLOCK', 'TABLE_ROW_CLONE', 'CONDITIONAL_SECTION', 'STATIC_INSERT']) {
  assertIncludes(mapping, term, `render plan supports ${term}`);
}

for (const term of ['assertDocxLayoutRendererV2Allowed', 'TABLE_ROW_PATTERN', 'cloneTableRowOperation', 'preserving surrounding DOCX XML', 'skippedOperations']) {
  assertIncludes(renderer, term, `renderer-v2 foundation includes ${term}`);
}

for (const term of ['TEXT_NODE_PATTERN', 'replaceSplitAlias', 'split-run', 'cloneParagraphBlockOperation', 'paragraph-block-clone', 'replaceConditionalOperation', 'conditional-removed', 'conditional-kept']) {
  assertIncludes(renderer, term, `renderer-v2 handles ${term}`);
}

for (const term of ['scanUnresolvedPlaceholders', 'unresolvedRequiredPlaceholders', 'dynamicTemplateRenderValidationManifest', 'mutatedPartCount', 'repeatValidation', 'expectedRepeatedItems', 'appliedRepeatedItems']) {
  assertIncludes(validation, term, `render validation includes ${term}`);
}

for (const term of ['gradeDynamicTemplateRender', 'DynamicTemplateQualityGrade', 'PRODUCTION_READY', 'BLOCKED', 'score', 'tier']) {
  assertIncludes(quality, term, `quality framework includes ${term}`);
}

for (const term of ['evaluateDynamicTemplateAdvancedZones', 'dynamicTemplateAdvancedZoneManifest', 'TEXT_BOX', 'DRAWING', 'CONTENT_CONTROL', 'ALT_CHUNK']) {
  assertIncludes(advancedZones, term, `advanced-zone policy includes ${term}`);
}

for (const term of ['renderDynamicDocxTemplateV2', 'inspectDynamicTemplateContractV2', 'buildDynamicTemplateRenderPlan', 'renderDocxLayoutV2', 'validateDynamicTemplateRender', 'gradeDynamicTemplateRender', 'evaluateDynamicTemplateAdvancedZones']) {
  assertIncludes(orchestrator, term, `orchestrator connects ${term}`);
}

for (const term of ['tryRenderDynamicAppendixTemplateV2', 'AFFIDAVIT', 'FTC', 'ftcRoute', 'shouldUseDynamicDocxLayoutV2', 'renderDynamicDocxTemplateV2']) {
  assertIncludes(appendixBridge, term, `appendix bridge connects ${term}`);
}

for (const term of ['TEMPLATE_ANCHOR_ALIAS_REGISTRY', 'FRAUDULENT ACCOUNTS FOR IMMEDIATE BLOCKING AND DELETION', 'ACCOUNT NAME:']) {
  assertIncludes(anchorRegistry, term, `anchor registry covers ${term}`);
}
for (const term of ['readDocxStructure', 'word/document.xml', 'bookmarkNames', 'contentControlTags']) {
  assertIncludes(structureReader, term, `DOCX structure reader includes ${term}`);
}
for (const term of ['detectTemplateAnchors', 'paragraph-pattern', 'manager-rule', 'fallback-created']) {
  assertIncludes(sectionDetector, term, `semantic detector includes ${term}`);
}
for (const term of ['resolveInsertionZone', 'replace-detected-items', 'append-before-signature']) {
  assertIncludes(zoneResolver, term, `insertion zone resolver includes ${term}`);
}
for (const term of ['validateDynamicDocxAnchorContract', 'repair-needed', 'auto-created']) {
  assertIncludes(anchorValidator, term, `anchor contract validator includes ${term}`);
}
for (const term of ['ANCHOR_REPAIR_REQUIRED', 'TemplateRepairRequiredError', 'auto-create-section']) {
  assertIncludes(repairPlanner, term, `repair planner includes ${term}`);
}
for (const term of ['template_anchor_rules', 'template_validation_events', 'enable row level security']) {
  assertIncludes(anchorMigration, term, `anchor migration includes ${term}`);
}

assertIncludes(rendererMode, "'CONTRACT_V2_DIAGNOSTIC'", 'renderer mode defaults to diagnostics path');
assertIncludes(rendererMode, 'DOCX_LAYOUT_V2', 'renderer mode has explicit DOCX_LAYOUT_V2 gate');
assertIncludes(uploadRoute, 'autoBackfillDynamicTemplateV2', 'template GET route auto-backfills missing v2 metadata');
assertIncludes(uploadRoute, 'validation_json: validationJson', 'template upload stores validation_json');
assertIncludes(readinessControl, 'READINESS_CHECKLIST_DISABLED = true', 'readiness checklist is intentionally disabled');
assertIncludes(preflight, 'DISABLED_PREFLIGHT_RESULT', 'preflight is disabled and non-blocking while checklist is off');
assertIncludes(preflight, 'ready: true', 'disabled preflight cannot block generation');
assertIncludes(supplemental, 'tryRenderDynamicAppendixTemplateV2', 'appendix renderer calls v2 bridge');
assertIncludes(supplemental, 'renderer-v2 gate', 'appendix renderer reports v2 gate progress');
assertIncludes(ftcWorkflow, 'resolveFtcTemplate', 'FTC workflow resolves template through local or active asset fallback');
assertIncludes(ftcWorkflow, 'fetchActiveFtcTemplate', 'FTC workflow can fetch active template asset');
assertIncludes(ftcWorkflow, 'tryRenderDynamicAppendixTemplateV2', 'FTC workflow calls v2 bridge');
assertIncludes(renderer, 'allMatches(', 'renderer-v2 uses ES5-safe matchAll wrapper');
assertNotIncludes(renderer, 'for (const match of xml.matchAll', 'renderer-v2 does not iterate directly over xml.matchAll results');

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? '✅' : '❌'} ${check.label}`);
}

if (failed.length) {
  console.error(`\nDynamic Template Engine v2 regression guard failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nDynamic Template Engine v2 regression guard passed: ${checks.length} check(s).`);
