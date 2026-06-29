import type { TemplateDocumentKind } from '../template-contracts';
import { validateDynamicDocxAnchorContract, type DynamicTemplateContractValidation } from '../dynamic-template-intelligence';
import { domainForDocumentKind, type TemplateDomainKind } from './template-domain-registry';
import { readManagerTemplateStructureMap, type ManagerTemplateStructureMap } from './template-structure-map';
import { classifyStaticPreservationRules, staticPreservationSummary, type StaticBlockRuleDraft } from './template-static-block-classifier';
import { resolveTemplateFieldBindings, missingRequiredFieldBindings, type TemplateFieldBindingDraft } from './template-field-binding-resolver';
import { resolveTemplateEntityBlockRules, missingRequiredEntityBlocks, type TemplateEntityBlockRuleDraft } from './template-entity-block-resolver';
import { evaluateAffidavitReadiness, type AffidavitReadiness } from './template-affidavit-domain';
import { buildManagerIntentReview, type ManagerTemplateIntentReview } from './template-manager-intent';

export type ManagerOwnedTemplateRuntimeStatus = 'ready' | 'repair-needed' | 'blocked';

export type ManagerOwnedTemplateRuntimeContract = {
  version: 1;
  kind: TemplateDocumentKind;
  domain: TemplateDomainKind;
  status: ManagerOwnedTemplateRuntimeStatus;
  structure: ManagerTemplateStructureMap;
  anchorValidation: DynamicTemplateContractValidation;
  staticBlocks: StaticBlockRuleDraft[];
  fieldBindings: TemplateFieldBindingDraft[];
  entityBlocks: TemplateEntityBlockRuleDraft[];
  affidavitReadiness: AffidavitReadiness | null;
  managerIntentReview: ManagerTemplateIntentReview[];
  warnings: string[];
  blockers: string[];
  summary: {
    paragraphCount: number;
    tableCount: number;
    preservedBlocks: number;
    unknownCustomBlocks: number;
    mappedFields: number;
    missingRequiredFields: number;
    entityBlocksReady: number;
    entityBlocksMissing: number;
  };
};

function statusFor(input: { anchorValidation: DynamicTemplateContractValidation; missingFields: TemplateFieldBindingDraft[]; missingEntities: TemplateEntityBlockRuleDraft[]; affidavitReadiness: AffidavitReadiness | null }) {
  if (input.anchorValidation.status === 'blocked' || input.missingEntities.length) return 'blocked' as const;
  if (input.missingFields.length && input.affidavitReadiness?.status === 'blocked') return 'blocked' as const;
  if (input.anchorValidation.status === 'repair-needed' || input.missingFields.length || input.affidavitReadiness?.status === 'needs-mapping') return 'repair-needed' as const;
  return 'ready' as const;
}

export async function buildManagerOwnedTemplateRuntimeContract(input: {
  template: Blob | ArrayBuffer | Uint8Array | string;
  kind: TemplateDocumentKind;
  previousStructure?: ManagerTemplateStructureMap | null;
}): Promise<ManagerOwnedTemplateRuntimeContract> {
  const domain = domainForDocumentKind(input.kind);
  const structure = await readManagerTemplateStructureMap(input.template, domain);
  const anchorValidation = await validateDynamicDocxAnchorContract(input.template);
  const staticBlocks = classifyStaticPreservationRules(structure);
  const fieldBindings = resolveTemplateFieldBindings(structure.raw, domain);
  const entityBlocks = resolveTemplateEntityBlockRules(structure.raw, domain);
  const missingFields = missingRequiredFieldBindings(fieldBindings);
  const missingEntities = missingRequiredEntityBlocks(entityBlocks);
  const affidavitReadiness = domain === 'AFFIDAVIT' ? evaluateAffidavitReadiness({ fieldBindings, entityBlocks }) : null;
  const managerIntentReview = buildManagerIntentReview(structure, input.previousStructure);
  const preservation = staticPreservationSummary(structure);
  const warnings = [
    ...anchorValidation.warnings,
    ...missingFields.map((field) => `Required field ${field.fieldKey} needs manager mapping or canonical fallback confirmation.`),
    ...(affidavitReadiness?.warnings || []),
    ...managerIntentReview.filter((item) => item.severity !== 'low').map((item) => item.label)
  ];
  const blockers = [
    ...missingEntities.map((entity) => `Required entity block ${entity.entityKey} is missing.`),
    ...(affidavitReadiness?.status === 'blocked' ? affidavitReadiness.requiredActions : [])
  ];
  const status = statusFor({ anchorValidation, missingFields, missingEntities, affidavitReadiness });

  return {
    version: 1,
    kind: input.kind,
    domain,
    status: blockers.length ? 'blocked' : status,
    structure,
    anchorValidation,
    staticBlocks,
    fieldBindings,
    entityBlocks,
    affidavitReadiness,
    managerIntentReview,
    warnings,
    blockers,
    summary: {
      paragraphCount: structure.paragraphCount,
      tableCount: structure.tableCount,
      preservedBlocks: preservation.preservedBlocks,
      unknownCustomBlocks: preservation.unknownCustomBlocks,
      mappedFields: fieldBindings.filter((field) => field.bindingStatus === 'mapped').length,
      missingRequiredFields: missingFields.length,
      entityBlocksReady: entityBlocks.filter((entity) => entity.ruleStatus === 'active').length,
      entityBlocksMissing: missingEntities.length
    }
  };
}

export function managerOwnedTemplateRuntimeManifest(contract: ManagerOwnedTemplateRuntimeContract) {
  return {
    managerOwnedDocx: {
      version: contract.version,
      kind: contract.kind,
      domain: contract.domain,
      status: contract.status,
      summary: contract.summary,
      warnings: contract.warnings,
      blockers: contract.blockers,
      anchorStatus: contract.anchorValidation.status,
      fieldBindings: contract.fieldBindings.map((binding) => ({ fieldKey: binding.fieldKey, status: binding.bindingStatus, required: binding.required, paragraphIndex: binding.paragraphIndex })),
      entityBlocks: contract.entityBlocks.map((entity) => ({ entityKey: entity.entityKey, status: entity.ruleStatus, startParagraphIndex: entity.startParagraphIndex, endParagraphIndex: entity.endParagraphIndex, repeatMode: entity.repeatMode })),
      affidavit: contract.affidavitReadiness,
      intentReview: contract.managerIntentReview.map((item) => ({ action: item.action, label: item.label, severity: item.severity, managerIntent: item.managerIntent }))
    }
  };
}
