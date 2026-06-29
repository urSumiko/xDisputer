import { TEMPLATE_ANCHOR_ALIAS_REGISTRY, type TemplateAnchorKind } from './anchor-alias-registry';
import { readDocxStructure, type DocxStructureMap } from './docx-structure-reader';
import { buildAnchorRepairPlan, type TemplateRepairStep } from './generation-repair-planner';
import { resolveBestInsertionZone, type InsertionZone } from './insertion-zone-resolver';
import { bestDetectedAnchor, detectTemplateAnchors, type DetectedAnchor } from './semantic-section-detector';
import type { TemplateManagerRule } from './template-rule-store';

export type TemplateAnchorValidation = {
  kind: TemplateAnchorKind;
  status: 'found' | 'weak' | 'missing' | 'auto-created';
  confidence: number;
  action: 'none' | 'manager-review' | 'auto-create' | 'block';
  anchor: DetectedAnchor | null;
  insertionZone: InsertionZone | null;
};

export type TemplateContractValidationStatus = 'ready' | 'repair-needed' | 'blocked';

export type DynamicTemplateContractValidation = {
  status: TemplateContractValidationStatus;
  anchors: TemplateAnchorValidation[];
  repairPlan: TemplateRepairStep[];
  warnings: string[];
  structure: Pick<DocxStructureMap, 'paragraphCount' | 'tableCount' | 'bookmarks' | 'contentControls'>;
};

function statusForAnchor(kind: TemplateAnchorKind, anchor: DetectedAnchor | null, zone: InsertionZone | null): TemplateAnchorValidation {
  if (!anchor || !zone) {
    return { kind, status: 'missing', confidence: 0, action: 'block', anchor, insertionZone: zone };
  }
  if (anchor.source === 'fallback-created') {
    return { kind, status: 'auto-created', confidence: anchor.confidence, action: 'auto-create', anchor, insertionZone: zone };
  }
  if (zone.requiresManagerReview) {
    return { kind, status: 'weak', confidence: zone.confidence, action: 'manager-review', anchor, insertionZone: zone };
  }
  return { kind, status: 'found', confidence: zone.confidence, action: 'none', anchor, insertionZone: zone };
}

export function validateDynamicDocxAnchorContractFromStructure(structure: DocxStructureMap, managerRules: TemplateManagerRule[] = []): DynamicTemplateContractValidation {
  const detected = detectTemplateAnchors(structure, managerRules);
  const anchors = TEMPLATE_ANCHOR_ALIAS_REGISTRY
    .filter((rule) => rule.required || ['FRAUDULENT_ACCOUNTS', 'DISPUTE_ACCOUNTS', 'SUPPORTING_DOCUMENTS', 'SIGNATURE'].includes(rule.kind))
    .map((rule) => {
      const anchor = bestDetectedAnchor(detected, rule.kind);
      const zone = resolveBestInsertionZone(structure, detected, rule.kind);
      return statusForAnchor(rule.kind, anchor, zone);
    });
  const repairPlan = anchors.flatMap((anchor) => anchor.action === 'none' ? [] : buildAnchorRepairPlan(anchor.kind, structure, detected, anchor.insertionZone));
  const blocked = anchors.some((anchor) => anchor.action === 'block');
  const needsRepair = anchors.some((anchor) => anchor.action === 'manager-review' || anchor.action === 'auto-create');
  const warnings = anchors
    .filter((anchor) => anchor.action !== 'none')
    .map((anchor) => `${anchor.kind}: ${anchor.status} (${Math.round(anchor.confidence * 100)}% confidence)`);
  return {
    status: blocked ? 'blocked' : needsRepair ? 'repair-needed' : 'ready',
    anchors,
    repairPlan,
    warnings,
    structure: {
      paragraphCount: structure.paragraphCount,
      tableCount: structure.tableCount,
      bookmarks: structure.bookmarks,
      contentControls: structure.contentControls
    }
  };
}

export async function validateDynamicDocxAnchorContract(input: Blob | ArrayBuffer | Uint8Array | string, managerRules: TemplateManagerRule[] = []) {
  const structure = await readDocxStructure(input);
  return validateDynamicDocxAnchorContractFromStructure(structure, managerRules);
}
