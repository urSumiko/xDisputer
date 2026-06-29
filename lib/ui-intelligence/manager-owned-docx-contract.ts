import type { FeatureContract, UIContract } from './types';

export const managerOwnedDocxGenerationContract: UIContract = {
  id: 'manager-owned-docx-generation',
  kind: 'template',
  scope: 'domain',
  owner: 'manager',
  label: 'Manager-Owned Dynamic DOCX Generation',
  description: 'Full uploaded-DOCX preservation contract for static blocks, field bindings, entity repeat blocks, affidavit mapping, future template domains, and client generation.',
  sourceFiles: [
    'lib/manager-template-contract/template-domain-registry.ts',
    'lib/manager-template-contract/template-structure-map.ts',
    'lib/manager-template-contract/template-static-block-classifier.ts',
    'lib/manager-template-contract/template-field-binding-resolver.ts',
    'lib/manager-template-contract/template-entity-block-resolver.ts',
    'lib/manager-template-contract/template-affidavit-domain.ts',
    'lib/manager-template-contract/template-runtime-contract.ts',
    'lib/manager-template-contract/template-generation-router.ts',
    'lib/dynamic-template/render-orchestrator.ts',
    'supabase/migrations/20260616123000_manager_owned_docx_generation.sql'
  ],
  connectedRoutes: ['/manager-workspace/studio', '/manager-workspace/engine', '/workspace', '/api/template-assets', '/api/client-template-runtime/generate'],
  connectedProcesses: ['manager-docx-upload', 'static-block-preservation', 'field-binding', 'entity-block-repeat', 'affidavit-generation', 'client-generation'],
  requiredMarkers: ['MANAGER_TEMPLATE_DOMAIN_REGISTRY', 'UNKNOWN_MANAGER_CUSTOM_TEXT', 'classifyStaticPreservationRules', 'resolveTemplateFieldBindings', 'resolveTemplateEntityBlockRules', 'evaluateAffidavitReadiness', 'buildManagerOwnedTemplateRuntimeContract', 'routeManagerOwnedDocxGeneration'],
  designTokens: ['manager-owned-docx', 'template-static-preservation', 'affidavit-mapping'],
  dependencies: ['dynamic-template-anchor-intelligence', 'template_assets', 'template_static_block_rules', 'template_field_bindings', 'template_entity_block_rules', 'template_domain_contracts'],
  allowedCustomizations: ['static text', 'heading text', 'colors', 'font styling', 'section order', 'account prototype block', 'affidavit text', 'future domain config'],
  forbiddenPatterns: ['discard unknown manager custom text', 'rebuild entire DOCX from internal canonical body', 'affidavit only referenced as static text'],
  propagationGroup: 'manager-owned-docx-generation'
};

export const managerOwnedDocxFeatureContract: FeatureContract = {
  id: 'manager-owned-docx-generation',
  label: 'Manager-Owned Dynamic DOCX Generation',
  owner: 'manager',
  status: 'active',
  entryRoutes: ['/manager-workspace/studio', '/manager-workspace/engine', '/workspace'],
  sourceFiles: managerOwnedDocxGenerationContract.sourceFiles,
  apiRoutes: ['/api/template-assets', '/api/client-template-runtime/generate'],
  databaseObjects: ['template_static_block_rules', 'template_field_bindings', 'template_entity_block_rules', 'template_domain_contracts', 'template_anchor_rules'],
  uiContracts: ['manager-owned-docx-generation', 'dynamic-template-anchor-intelligence', 'client-template-handoff'],
  dependencies: ['manager template domain registry', 'static block classifier', 'entity block resolver', 'affidavit readiness evaluator'],
  fallbackBehavior: 'Preserve unknown manager custom text by default, warn on missing field bindings, and block only when required entity zones or affidavit required data are unresolved.'
};
