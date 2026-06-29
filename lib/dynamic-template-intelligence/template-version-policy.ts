import type { DynamicTemplateContractValidation } from './template-contract-validator';
import type { TemplateDiffAnalysis } from './template-diff-analyzer';

export type TemplateVersionDecision = {
  status: 'accept' | 'accept-with-repair' | 'block';
  reason: string;
  requiredActions: string[];
};

export function decideTemplateVersionPolicy(validation: DynamicTemplateContractValidation, diff?: TemplateDiffAnalysis): TemplateVersionDecision {
  const highRiskDiff = diff?.risks.filter((risk) => risk.severity === 'high') || [];
  if (validation.status === 'blocked') {
    return {
      status: 'block',
      reason: 'Required dynamic anchors are missing and no safe fallback was resolved.',
      requiredActions: validation.repairPlan.map((step) => step.label)
    };
  }
  if (validation.status === 'repair-needed' || highRiskDiff.length) {
    return {
      status: 'accept-with-repair',
      reason: highRiskDiff.length ? 'A previous required anchor was removed or cannot be matched confidently.' : 'One or more dynamic anchors need manager confirmation.',
      requiredActions: [...validation.repairPlan.map((step) => step.label), ...highRiskDiff.map((risk) => risk.label)]
    };
  }
  return { status: 'accept', reason: 'Dynamic anchor contract is ready.', requiredActions: [] };
}
