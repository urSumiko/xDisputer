import { analyzeTemplateStructureDiff, type TemplateDiffAnalysis } from '../dynamic-template-intelligence';
import type { ManagerTemplateStructureMap } from './template-structure-map';
import type { ManagerTemplateIntent } from './template-static-block-classifier';

export type ManagerTemplateIntentReview = {
  action: 'confirm-preserve' | 'confirm-remove' | 'confirm-optional' | 'confirm-style-seed' | 'confirm-anchor-repair';
  label: string;
  managerIntent: ManagerTemplateIntent;
  severity: 'low' | 'medium' | 'high';
  sampleText?: string;
  reason: string;
};

export function buildManagerIntentReview(current: ManagerTemplateStructureMap, previous?: ManagerTemplateStructureMap | null): ManagerTemplateIntentReview[] {
  const review: ManagerTemplateIntentReview[] = [];
  for (const block of current.blocks) {
    if (block.kind === 'UNKNOWN_MANAGER_CUSTOM_TEXT' && block.sampleText.length > 8) {
      review.push({
        action: 'confirm-preserve',
        label: 'Preserve manager custom text',
        managerIntent: 'PRESERVE',
        severity: 'low',
        sampleText: block.sampleText,
        reason: 'Unknown manager-authored text is preserved by default but should be visible in Template Studio.'
      });
    }
    if (block.kind === 'REPEATING_ENTITY_BLOCK') {
      review.push({
        action: 'confirm-style-seed',
        label: 'Use detected entity block as style seed',
        managerIntent: 'USE_AS_STYLE_SEED',
        severity: 'medium',
        sampleText: block.sampleText,
        reason: 'Detected account/entity block can provide paragraph styling for generated repeated items.'
      });
    }
  }
  if (previous) {
    const diff = analyzeTemplateStructureDiff(previous.raw, current.raw);
    review.push(...managerIntentReviewFromDiff(diff));
  }
  return review;
}

export function managerIntentReviewFromDiff(diff: TemplateDiffAnalysis): ManagerTemplateIntentReview[] {
  return diff.risks.map((risk) => ({
    action: risk.kind === 'removed-anchor' ? 'confirm-anchor-repair' : risk.kind === 'removed-static-block' ? 'confirm-remove' : 'confirm-preserve',
    label: risk.label,
    managerIntent: risk.kind === 'removed-static-block' ? 'REMOVE' : risk.kind === 'moved-anchor' ? 'REQUIRES_REVIEW' : 'PRESERVE',
    severity: risk.severity,
    sampleText: risk.detail,
    reason: risk.detail
  }));
}
