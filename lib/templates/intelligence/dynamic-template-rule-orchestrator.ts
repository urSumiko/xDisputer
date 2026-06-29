import type { DynamicTemplateDbClient, DynamicTemplateExecutionItem, DynamicTemplateExecutionModel, DynamicTemplateRule } from './dynamic-template-types';
import { loadEnabledDynamicTemplateRules } from './dynamic-template-rule-registry';

function itemFromRule(rule: DynamicTemplateRule): DynamicTemplateExecutionItem {
  if (!rule.enabled) return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'block', target: rule.sourceText || rule.ruleKey, status: 'disabled', reason: 'Rule is disabled.' };
  if (rule.validationState === 'blocked') return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'block', target: rule.sourceText || rule.ruleKey, status: 'blocked', reason: rule.validationReason || 'Rule is blocked.' };
  if (rule.ruleType === 'preserve-static-text' || rule.preserve) return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'preserve', target: rule.sourceText || rule.ruleKey, status: rule.validationState === 'warning' ? 'warning' : 'ready', reason: 'Preserve content from manager-approved template.' };
  if (rule.ruleType === 'replace-variable' || rule.ruleType === 'canonical-field-map') return { ruleId: rule.id, ruleKey: rule.ruleKey, action: rule.canonicalField ? 'replace' : 'block', target: rule.outputToken || rule.sourceText || rule.ruleKey, status: rule.canonicalField ? 'ready' : 'blocked', reason: rule.canonicalField ? `Bind to ${rule.canonicalField}.` : 'Missing canonical field mapping.' };
  if (rule.ruleType === 'parser-directive') return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'parse', target: rule.outputToken || rule.sourceText || rule.ruleKey, status: 'ready', reason: 'Parser directive is enabled.' };
  if (rule.ruleType === 'renderer-directive' || rule.ruleType === 'table-layout') return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'render', target: rule.sourceText || rule.ruleKey, status: rule.validationState === 'warning' ? 'warning' : 'ready', reason: rule.validationReason || 'Renderer directive is enabled.' };
  return { ruleId: rule.id, ruleKey: rule.ruleKey, action: 'generate', target: rule.sourceText || rule.ruleKey, status: rule.validationState === 'warning' ? 'warning' : 'ready', reason: rule.validationReason || 'Manager generation rule is enabled.' };
}

export async function buildDynamicTemplateExecutionModel(input: {
  supabase: DynamicTemplateDbClient;
  managerUserId: string;
  templateAssetId: string;
  clientId?: string;
}): Promise<DynamicTemplateExecutionModel> {
  const rulesResult = await loadEnabledDynamicTemplateRules({ supabase: input.supabase, managerUserId: input.managerUserId, templateAssetId: input.templateAssetId });
  const rules = rulesResult.ok ? rulesResult.rules : [];
  const executionModel = rules.sort((a, b) => a.priority - b.priority).map(itemFromRule);
  const blockers = executionModel.filter((item) => item.status === 'blocked').map((item) => item.reason);
  const warnings = executionModel.filter((item) => item.status === 'warning').map((item) => item.reason);
  return {
    templateAssetId: input.templateAssetId,
    managerUserId: input.managerUserId,
    clientId: input.clientId || null,
    inspectionId: rules[0]?.inspectionId || null,
    rulesCount: rules.length,
    executionModel,
    blockers: rulesResult.ok ? blockers : [rulesResult.error || 'Could not load enabled dynamic template rules.'],
    warnings,
    ready: rulesResult.ok && blockers.length === 0 && rules.length > 0
  };
}
