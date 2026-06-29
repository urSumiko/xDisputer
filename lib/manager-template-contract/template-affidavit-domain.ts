import type { DynamicCanonicalFieldKey } from '../dynamic-template/field-registry';
import type { TemplateFieldBindingDraft } from './template-field-binding-resolver';
import type { TemplateEntityBlockRuleDraft } from './template-entity-block-resolver';

export type AffidavitReadiness = {
  status: 'ready' | 'needs-mapping' | 'blocked';
  missingFields: DynamicCanonicalFieldKey[];
  missingEntities: string[];
  warnings: string[];
  requiredActions: string[];
};

export const AFFIDAVIT_REQUIRED_FIELDS: DynamicCanonicalFieldKey[] = [
  'client.name',
  'client.addressLines',
  'client.ssnMasked',
  'letter.date'
];

export const AFFIDAVIT_RECOMMENDED_FIELDS: DynamicCanonicalFieldKey[] = [
  'client.dob',
  'affidavit.state',
  'affidavit.county',
  'ftc.reportNumber',
  'ftc.reportDate',
  'ftc.statement'
];

export function evaluateAffidavitReadiness(input: {
  fieldBindings: TemplateFieldBindingDraft[];
  entityBlocks: TemplateEntityBlockRuleDraft[];
}): AffidavitReadiness {
  const missingFields = AFFIDAVIT_REQUIRED_FIELDS.filter((field) => {
    const binding = input.fieldBindings.find((item) => item.fieldKey === field);
    return !binding || (binding.bindingStatus !== 'mapped' && binding.bindingStatus !== 'optional');
  });
  const missingRecommended = AFFIDAVIT_RECOMMENDED_FIELDS.filter((field) => {
    const binding = input.fieldBindings.find((item) => item.fieldKey === field);
    return !binding || binding.bindingStatus === 'needs-review' || binding.bindingStatus === 'missing';
  });
  const disputeEntity = input.entityBlocks.find((item) => item.entityKey === 'dispute_accounts');
  const missingEntities = disputeEntity && disputeEntity.ruleStatus !== 'missing' ? [] : ['dispute_accounts'];
  const requiredActions = [
    ...missingFields.map((field) => `Map required affidavit field: ${field}`),
    ...missingEntities.map((entity) => `Map required affidavit entity block: ${entity}`),
    ...missingRecommended.map((field) => `Review recommended affidavit field: ${field}`)
  ];
  const hardBlockers = missingFields.length + missingEntities.length;
  return {
    status: hardBlockers ? 'blocked' : missingRecommended.length ? 'needs-mapping' : 'ready',
    missingFields,
    missingEntities,
    warnings: missingRecommended.map((field) => `${field} is recommended for affidavit precision but not mapped explicitly.`),
    requiredActions
  };
}

export function affidavitMissingReason(readiness: AffidavitReadiness) {
  if (readiness.status === 'ready') return 'Affidavit domain is mapped and ready.';
  if (readiness.status === 'needs-mapping') return `Affidavit can run with warnings: ${readiness.warnings.join(' ')}`;
  return `Affidavit cannot generate yet: ${readiness.requiredActions.join(' ')}`;
}
