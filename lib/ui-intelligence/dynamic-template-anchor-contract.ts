import type { FeatureContract, UIContract } from './types';

export const dynamicTemplateAnchorIntelligenceContract: UIContract = {
  id: 'dynamic-template-anchor-intelligence',
  kind: 'template',
  scope: 'domain',
  owner: 'manager',
  label: 'Dynamic DOCX Anchor Intelligence',
  description: 'Semantic DOCX anchor detection, insertion-zone resolution, repair planning, and manager-pinned anchor rules for editable DOCX templates.',
  sourceFiles: [
    'lib/dynamic-template-intelligence/anchor-alias-registry.ts',
    'lib/dynamic-template-intelligence/docx-structure-reader.ts',
    'lib/dynamic-template-intelligence/semantic-section-detector.ts',
    'lib/dynamic-template-intelligence/insertion-zone-resolver.ts',
    'lib/dynamic-template-intelligence/template-contract-validator.ts',
    'lib/dynamic-template-intelligence/generation-repair-planner.ts',
    'supabase/migrations/20260616120000_dynamic_template_anchor_intelligence.sql'
  ],
  connectedRoutes: ['/manager-workspace/studio', '/manager-workspace/engine', '/workspace', '/api/template-assets', '/api/client-template-runtime/generate'],
  connectedProcesses: ['manager-template-upload', 'semantic-anchor-detection', 'insertion-zone-resolution', 'repair-plan', 'client-generation'],
  requiredMarkers: ['TEMPLATE_ANCHOR_ALIAS_REGISTRY', 'detectTemplateAnchors', 'resolveInsertionZone', 'validateDynamicDocxAnchorContract', 'ANCHOR_REPAIR_REQUIRED', 'template_anchor_rules', 'template_validation_events'],
  designTokens: ['template-anchor-repair', 'dynamic-template-intelligence'],
  dependencies: ['template_assets', 'Template Studio', 'Generation Engine', 'client-template-handoff'],
  allowedCustomizations: ['anchor aliases', 'manager-pinned paragraph', 'auto-create policy', 'template family reuse'],
  forbiddenPatterns: ['exact-heading-only anchor detection', 'hard fail when policy can auto-create', 'unregistered required anchor'],
  propagationGroup: 'dynamic-template-anchor-intelligence'
};

export const dynamicTemplateAnchorFeatureContract: FeatureContract = {
  id: 'dynamic-template-anchor-intelligence',
  label: 'Dynamic DOCX Anchor Intelligence',
  owner: 'manager',
  status: 'active',
  entryRoutes: ['/manager-workspace/studio', '/manager-workspace/engine', '/workspace'],
  sourceFiles: dynamicTemplateAnchorIntelligenceContract.sourceFiles,
  apiRoutes: ['/api/template-assets', '/api/client-template-runtime/generate'],
  databaseObjects: ['template_anchor_rules', 'template_validation_events', 'template_assets'],
  uiContracts: ['dynamic-template-anchor-intelligence', 'client-template-handoff', 'manager-template-workspace-integrity'],
  dependencies: ['semantic section detector', 'insertion zone resolver', 'manager repair plan'],
  fallbackBehavior: 'If an exact DOCX anchor is missing, detect by alias/pattern, auto-create when allowed, or route manager to Template Studio repair instead of raw generation failure.'
};
