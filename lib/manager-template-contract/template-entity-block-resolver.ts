import { detectTemplateAnchors, resolveBestInsertionZone, type DocxStructureMap } from '../dynamic-template-intelligence';
import type { ManagerTemplateEntityKey, TemplateDomainKind } from './template-domain-registry';
import { managerTemplateDomain } from './template-domain-registry';

export type EntityRepeatMode = 'clone-paragraphs' | 'clone-table-row' | 'insert-after-heading';
export type EntityEmptyBehavior = 'remove-section' | 'show-empty-message' | 'block-generation';

export type TemplateEntityBlockRuleDraft = {
  domain: TemplateDomainKind;
  entityKey: ManagerTemplateEntityKey;
  startParagraphIndex: number | null;
  endParagraphIndex: number | null;
  repeatMode: EntityRepeatMode;
  preserveStyle: boolean;
  emptyBehavior: EntityEmptyBehavior;
  requiredFields: string[];
  prototypeText: string | null;
  confidence: number;
  ruleStatus: 'active' | 'needs-review' | 'missing';
  reason: string;
};

const ENTITY_TO_ANCHOR: Partial<Record<ManagerTemplateEntityKey, 'FRAUDULENT_ACCOUNTS' | 'HARD_INQUIRIES' | 'LATE_PAYMENTS' | 'SUPPORTING_DOCUMENTS'>> = {
  dispute_accounts: 'FRAUDULENT_ACCOUNTS',
  hard_inquiries: 'HARD_INQUIRIES',
  late_payments: 'LATE_PAYMENTS',
  supporting_documents: 'SUPPORTING_DOCUMENTS'
};

function requiredFieldsForEntity(entityKey: ManagerTemplateEntityKey) {
  if (entityKey === 'dispute_accounts') return ['account.name', 'account.number'];
  if (entityKey === 'late_payments') return ['account.name', 'payment.status'];
  if (entityKey === 'hard_inquiries') return ['inquiry.name', 'inquiry.date'];
  if (entityKey === 'supporting_documents') return ['document.name'];
  if (entityKey === 'bankruptcy_records') return ['record.name', 'record.caseNumber'];
  if (entityKey === 'chexsystems_items') return ['bank.name', 'report.item'];
  return ['item.name'];
}

export function resolveTemplateEntityBlockRules(structure: DocxStructureMap, domain: TemplateDomainKind): TemplateEntityBlockRuleDraft[] {
  const contract = managerTemplateDomain(domain);
  const entities = Array.from(new Set([...(contract?.requiredEntities || []), ...(contract?.optionalEntities || [])]));
  const required = new Set(contract?.requiredEntities || []);
  const anchors = detectTemplateAnchors(structure);

  return entities.map((entityKey) => {
    const anchorKind = ENTITY_TO_ANCHOR[entityKey];
    const zone = anchorKind ? resolveBestInsertionZone(structure, anchors, anchorKind) : null;
    const prototype = zone?.startParagraphIndex !== undefined && zone?.startParagraphIndex !== null ? structure.paragraphs[zone.startParagraphIndex]?.text || null : null;
    if (zone) {
      return {
        domain,
        entityKey,
        startParagraphIndex: zone.startParagraphIndex,
        endParagraphIndex: zone.endParagraphIndex,
        repeatMode: zone.insertMode === 'replace-detected-items' ? 'clone-paragraphs' : 'insert-after-heading',
        preserveStyle: true,
        emptyBehavior: required.has(entityKey) ? 'block-generation' : 'remove-section',
        requiredFields: requiredFieldsForEntity(entityKey),
        prototypeText: prototype,
        confidence: zone.confidence,
        ruleStatus: zone.requiresManagerReview ? 'needs-review' : 'active',
        reason: zone.reason
      } satisfies TemplateEntityBlockRuleDraft;
    }
    return {
      domain,
      entityKey,
      startParagraphIndex: null,
      endParagraphIndex: null,
      repeatMode: 'insert-after-heading',
      preserveStyle: true,
      emptyBehavior: required.has(entityKey) ? 'block-generation' : 'remove-section',
      requiredFields: requiredFieldsForEntity(entityKey),
      prototypeText: null,
      confidence: 0,
      ruleStatus: required.has(entityKey) ? 'missing' : 'needs-review',
      reason: required.has(entityKey) ? 'Required entity block has no resolved insertion zone.' : 'Optional entity block is not present and can be added later.'
    } satisfies TemplateEntityBlockRuleDraft;
  });
}

export function missingRequiredEntityBlocks(rules: TemplateEntityBlockRuleDraft[]) {
  return rules.filter((rule) => rule.emptyBehavior === 'block-generation' && rule.ruleStatus === 'missing');
}
