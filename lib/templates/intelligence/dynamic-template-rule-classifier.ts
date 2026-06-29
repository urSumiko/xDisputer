import type { DynamicTemplateFinding, DynamicTemplateRule, DynamicTemplateRuleType, DynamicTemplateValidationState } from './dynamic-template-types';

function stableKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 96) || 'rule';
}

function validationStateFor(finding: DynamicTemplateFinding): DynamicTemplateValidationState {
  if (finding.type === 'blocker-rule') return 'blocked';
  if (finding.type === 'canonical-field-map' || finding.type === 'replace-variable') return finding.suggestedCanonicalField ? 'valid' : finding.required ? 'blocked' : 'warning';
  if (finding.type === 'table-layout') return 'warning';
  return finding.confidence >= 0.72 ? 'valid' : 'warning';
}

function priorityFor(type: DynamicTemplateRuleType, required: boolean) {
  if (type === 'blocker-rule') return 1;
  if (type === 'preserve-static-text') return 10;
  if (type === 'table-layout') return 15;
  if (type === 'canonical-field-map' || type === 'replace-variable') return required ? 20 : 60;
  if (type === 'declaration-rule') return 25;
  return 100;
}

export function classifyFindingToRule(input: {
  finding: DynamicTemplateFinding;
  managerUserId: string;
  templateAssetId: string;
  inspectionId: string;
}): DynamicTemplateRule {
  const state = validationStateFor(input.finding);
  const key = input.finding.suggestedRuleKey || stableKey(`${input.finding.type}:${input.finding.sourcePath}:${input.finding.sourceText}`);
  return {
    id: key,
    managerUserId: input.managerUserId,
    templateAssetId: input.templateAssetId,
    inspectionId: input.inspectionId,
    ruleKey: key,
    ruleType: input.finding.type,
    ruleScope: input.finding.scope,
    sourcePath: input.finding.sourcePath,
    sourceText: input.finding.sourceText,
    canonicalField: input.finding.suggestedCanonicalField || null,
    outputToken: input.finding.suggestedOutputToken || null,
    preserve: input.finding.preserve,
    required: input.finding.required,
    enabled: true,
    priority: priorityFor(input.finding.type, input.finding.required),
    ruleConfig: {
      confidence: input.finding.confidence,
      reason: input.finding.reason,
      detectedAt: new Date().toISOString()
    },
    validationState: state,
    validationReason: state === 'blocked'
      ? 'Required finding must be resolved before release.'
      : state === 'warning'
        ? 'Review this rule before release.'
        : 'Rule is ready.'
  };
}

export function classifyFindingsToRules(input: {
  findings: DynamicTemplateFinding[];
  managerUserId: string;
  templateAssetId: string;
  inspectionId: string;
}) {
  return input.findings.map((finding) => classifyFindingToRule({ ...input, finding }));
}
