import { anchorPolicy, type TemplateAnchorKind } from './anchor-alias-registry';
import type { DocxStructureMap } from './docx-structure-reader';
import type { DetectedAnchor } from './semantic-section-detector';
import type { InsertionZone } from './insertion-zone-resolver';

export class TemplateRepairRequiredError extends Error {
  code = 'ANCHOR_REPAIR_REQUIRED' as const;
  anchorKind: TemplateAnchorKind;
  suggestions: string[];
  constructor(anchorKind: TemplateAnchorKind, suggestions: string[]) {
    super(`Template needs anchor mapping for ${anchorKind}.`);
    this.name = 'TemplateRepairRequiredError';
    this.anchorKind = anchorKind;
    this.suggestions = suggestions;
  }
}

export type TemplateRepairStep = {
  action: 'confirm-zone' | 'pin-paragraph' | 'auto-create-section' | 'mark-optional' | 'block-generation';
  anchorKind: TemplateAnchorKind;
  label: string;
  paragraphIndex?: number | null;
  confidence?: number;
  reason: string;
};

export function buildAnchorRepairPlan(anchorKind: TemplateAnchorKind, structure: DocxStructureMap, anchors: DetectedAnchor[], zone: InsertionZone | null): TemplateRepairStep[] {
  const policy = anchorPolicy(anchorKind);
  const candidates = anchors.filter((anchor) => anchor.kind === anchorKind).slice(0, 4);
  const steps: TemplateRepairStep[] = [];
  if (zone && zone.requiresManagerReview) {
    steps.push({ action: 'confirm-zone', anchorKind, label: 'Confirm detected insertion zone', paragraphIndex: zone.startParagraphIndex, confidence: zone.confidence, reason: zone.reason });
  }
  for (const candidate of candidates) {
    steps.push({ action: 'pin-paragraph', anchorKind, label: `Use paragraph ${candidate.paragraphIndex + 1} as insertion zone`, paragraphIndex: candidate.paragraphIndex, confidence: candidate.confidence, reason: candidate.reason });
  }
  if (policy.canAutoCreate) {
    const signature = structure.paragraphs.find((paragraph) => /^(SINCERELY|RESPECTFULLY|REGARDS|CC:)/i.test(paragraph.normalizedText));
    steps.push({ action: 'auto-create-section', anchorKind, label: 'Auto-create missing account section before signature', paragraphIndex: signature ? signature.index : null, confidence: 0.62, reason: 'Policy allows creating a safe missing section when manager removed the original block.' });
  }
  if (!policy.required) {
    steps.push({ action: 'mark-optional', anchorKind, label: 'Mark section optional for this template', reason: 'This anchor is optional in the current contract.' });
  }
  if (!steps.length) {
    steps.push({ action: 'block-generation', anchorKind, label: 'Block generation until manager pins the section', reason: 'No safe automatic anchor policy exists.' });
  }
  return steps;
}

export function assertZoneOrRepair(anchorKind: TemplateAnchorKind, structure: DocxStructureMap, anchors: DetectedAnchor[], zone: InsertionZone | null) {
  if (zone && !zone.requiresManagerReview) return zone;
  const repairPlan = buildAnchorRepairPlan(anchorKind, structure, anchors, zone);
  if (zone) return zone;
  throw new TemplateRepairRequiredError(anchorKind, repairPlan.map((step) => step.label));
}
