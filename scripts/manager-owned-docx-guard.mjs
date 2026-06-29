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
  'lib/manager-template-contract/template-domain-registry.ts',
  'lib/manager-template-contract/template-structure-map.ts',
  'lib/manager-template-contract/template-static-block-classifier.ts',
  'lib/manager-template-contract/template-field-binding-resolver.ts',
  'lib/manager-template-contract/template-entity-block-resolver.ts',
  'lib/manager-template-contract/template-affidavit-domain.ts',
  'lib/manager-template-contract/template-manager-intent.ts',
  'lib/manager-template-contract/template-runtime-contract.ts',
  'lib/manager-template-contract/template-generation-router.ts',
  'lib/manager-template-contract/index.ts',
  'lib/ui-intelligence/manager-owned-docx-contract.ts',
  'components/ManagerOwnedDocxStudioPanel.tsx',
  'components/ManagerTemplateWorkspaceClient.tsx',
  'app/api/template-contract-rules/route.ts',
  'app/manager-owned-docx-studio.css',
  'supabase/migrations/20260616123000_manager_owned_docx_generation.sql'
].forEach(read);

has('lib/manager-template-contract/template-domain-registry.ts', 'MANAGER_TEMPLATE_DOMAIN_REGISTRY');
has('lib/manager-template-contract/template-domain-registry.ts', 'BANKRUPTCY');
has('lib/manager-template-contract/template-domain-registry.ts', 'CHEXSYSTEMS');
has('lib/manager-template-contract/template-domain-registry.ts', 'AFFIDAVIT');
has('lib/manager-template-contract/template-structure-map.ts', 'UNKNOWN_MANAGER_CUSTOM_TEXT');
has('lib/manager-template-contract/template-structure-map.ts', 'preserveByDefault: true');
has('lib/manager-template-contract/template-static-block-classifier.ts', 'classifyStaticPreservationRules');
has('lib/manager-template-contract/template-field-binding-resolver.ts', 'resolveTemplateFieldBindings');
has('lib/manager-template-contract/template-entity-block-resolver.ts', 'resolveTemplateEntityBlockRules');
has('lib/manager-template-contract/template-affidavit-domain.ts', 'AFFIDAVIT_REQUIRED_FIELDS');
has('lib/manager-template-contract/template-affidavit-domain.ts', 'evaluateAffidavitReadiness');
has('lib/manager-template-contract/template-manager-intent.ts', 'buildManagerIntentReview');
has('lib/manager-template-contract/template-runtime-contract.ts', 'buildManagerOwnedTemplateRuntimeContract');
has('lib/manager-template-contract/template-runtime-contract.ts', 'managerOwnedTemplateRuntimeManifest');
has('lib/manager-template-contract/template-generation-router.ts', 'routeManagerOwnedDocxGeneration');
has('lib/manager-template-contract/template-generation-router.ts', 'mergeManagerOwnedWarningsIntoPlan');
has('lib/dynamic-template/render-orchestrator.ts', 'routeManagerOwnedDocxGeneration');
has('lib/dynamic-template/render-orchestrator.ts', 'managerOwnedGenerationManifest');
has('lib/dynamic-template/render-orchestrator.ts', 'managerOwnedRoute');
has('lib/ui-intelligence/manager-owned-docx-contract.ts', 'manager-owned-docx-generation');
has('lib/ui-intelligence/manager-owned-docx-contract.ts', 'template_static_block_rules');
has('lib/ui-intelligence/index.ts', 'managerOwnedDocxGenerationContract');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'data-manager-owned-docx-studio="true"');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'PRESERVE');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'REMOVE');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'MAKE_DYNAMIC');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'REPEAT_FOR_ENTITY');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'USE_AS_STYLE_SEED');
has('components/ManagerOwnedDocxStudioPanel.tsx', 'Review affidavit mapping');
has('components/ManagerTemplateWorkspaceClient.tsx', 'ManagerOwnedDocxStudioPanel');
has('app/api/template-contract-rules/route.ts', 'template_static_block_rules');
has('app/api/template-contract-rules/route.ts', 'template_field_bindings');
has('app/api/template-contract-rules/route.ts', 'template_entity_block_rules');
has('app/api/template-contract-rules/route.ts', 'template_domain_contracts');
has('app/manager-owned-docx-studio.css', 'manager-owned-docx-studio-panel');
has('app/layout.tsx', "import './manager-owned-docx-studio.css';");
has('supabase/migrations/20260616123000_manager_owned_docx_generation.sql', 'template_static_block_rules');
has('supabase/migrations/20260616123000_manager_owned_docx_generation.sql', 'template_field_bindings');
has('supabase/migrations/20260616123000_manager_owned_docx_generation.sql', 'template_entity_block_rules');
has('supabase/migrations/20260616123000_manager_owned_docx_generation.sql', 'template_domain_contracts');
has('supabase/migrations/20260616123000_manager_owned_docx_generation.sql', 'enable row level security');
has('package.json', 'manager-owned-docx:guard');
notHas('lib/manager-template-contract/template-structure-map.ts', 'preserveByDefault: false, reason: \'Unknown');

if (failures.length) {
  console.error('\nManager-owned DOCX guard failed.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Manager-owned DOCX guard passed.');
