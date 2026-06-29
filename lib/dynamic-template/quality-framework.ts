import type { DynamicTemplateContractV2 } from './contract-v2';
import type { DynamicRenderPlan } from './mapping-engine';
import type { DynamicTemplateRenderValidationResult } from './render-validation';

export type DynamicTemplateQualityTier = 'A' | 'B' | 'C' | 'D' | 'F';
export type DynamicTemplateQualityStatus = 'PRODUCTION_READY' | 'REVIEW_REQUIRED' | 'DEGRADED' | 'BLOCKED';

export type DynamicTemplateQualityGrade = {
  version: 1;
  score: number;
  tier: DynamicTemplateQualityTier;
  status: DynamicTemplateQualityStatus;
  blockers: string[];
  warnings: string[];
  recommendation: string;
  metrics: {
    contractStatus: string;
    contractConfidence: number;
    planStatus: string;
    renderValidationStatus: string;
    requiredFieldCount: number;
    missingRequiredFieldCount: number;
    operationCount: number;
    appliedOperationCount: number;
    skippedOperationCount: number;
    unresolvedPlaceholderCount: number;
    unresolvedRequiredPlaceholderCount: number;
    tableRowCloneOperationCount: number;
    repeatedOperationCount: number;
  };
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tierFor(score: number): DynamicTemplateQualityTier {
  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 75) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function statusFor(input: {
  tier: DynamicTemplateQualityTier;
  blockers: string[];
  validationStatus: DynamicTemplateRenderValidationResult['status'];
}) {
  if (input.blockers.length || input.validationStatus === 'FAIL') return 'BLOCKED';
  if (input.tier === 'A' || input.tier === 'B') return 'PRODUCTION_READY';
  if (input.tier === 'C') return 'REVIEW_REQUIRED';
  return 'DEGRADED';
}

function recommendationFor(status: DynamicTemplateQualityStatus) {
  if (status === 'PRODUCTION_READY') return 'Template output passed v2 proof checks and is ready for controlled generation.';
  if (status === 'REVIEW_REQUIRED') return 'Template output is usable but should be reviewed before broad rollout.';
  if (status === 'DEGRADED') return 'Template output is degraded. Review skipped operations, unresolved placeholders, and unsupported sections before use.';
  return 'Template output is blocked. Fix required fields, unknown placeholders, or unresolved required placeholders before generation.';
}

export function gradeDynamicTemplateRender(input: {
  contract: DynamicTemplateContractV2;
  plan: DynamicRenderPlan;
  validation: DynamicTemplateRenderValidationResult;
}): DynamicTemplateQualityGrade {
  const blockers = Array.from(new Set([
    ...input.contract.errors,
    ...input.plan.blockers,
    ...input.validation.blockers
  ].filter(Boolean)));
  const warnings = Array.from(new Set([
    ...input.contract.warnings,
    ...input.plan.warnings,
    ...input.validation.warnings
  ].filter(Boolean)));

  let score = 100;

  if (input.contract.status === 'BLOCKED') score -= 45;
  if (input.plan.status === 'BLOCKED') score -= 45;
  if (input.validation.status === 'FAIL') score -= 50;
  if (input.contract.status === 'WARNING') score -= 8;
  if (input.plan.status === 'WARNING') score -= 8;
  if (input.validation.status === 'WARNING') score -= 10;

  score -= input.contract.missingFields.length * 15;
  score -= input.plan.diagnostics.missingRequiredFieldCount * 15;
  score -= input.validation.unresolvedRequiredPlaceholders.length * 20;
  score -= input.validation.unresolvedPlaceholders.length * 4;
  score -= input.validation.skippedOperationCount * 6;
  score -= Math.min(12, warnings.length * 2);
  score += Math.min(5, input.validation.tableRowCloneOperationCount * 2);
  score += Math.min(5, input.validation.repeatedOperationCount * 1);

  const finalScore = blockers.length ? Math.min(clampScore(score), 59) : clampScore(score);
  const tier = tierFor(finalScore);
  const status = statusFor({ tier, blockers, validationStatus: input.validation.status });

  return {
    version: 1,
    score: finalScore,
    tier,
    status,
    blockers,
    warnings,
    recommendation: recommendationFor(status),
    metrics: {
      contractStatus: input.contract.status,
      contractConfidence: input.contract.confidence,
      planStatus: input.plan.status,
      renderValidationStatus: input.validation.status,
      requiredFieldCount: input.plan.diagnostics.requiredFieldCount,
      missingRequiredFieldCount: input.plan.diagnostics.missingRequiredFieldCount,
      operationCount: input.plan.diagnostics.operationCount,
      appliedOperationCount: input.validation.appliedOperationCount,
      skippedOperationCount: input.validation.skippedOperationCount,
      unresolvedPlaceholderCount: input.validation.unresolvedPlaceholders.length,
      unresolvedRequiredPlaceholderCount: input.validation.unresolvedRequiredPlaceholders.length,
      tableRowCloneOperationCount: input.validation.tableRowCloneOperationCount,
      repeatedOperationCount: input.validation.repeatedOperationCount
    }
  };
}

export function dynamicTemplateQualityManifest(grade: DynamicTemplateQualityGrade) {
  return {
    dynamicTemplateQuality: grade
  };
}
