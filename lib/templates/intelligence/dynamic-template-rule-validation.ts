import type { DynamicTemplateRule, DynamicTemplateRuleScope, DynamicTemplateRuleType, DynamicTemplateValidationState } from './dynamic-template-types';

const ruleTypes = new Set<DynamicTemplateRuleType>([
  'preserve-static-text',
  'replace-variable',
  'canonical-field-map',
  'detect-entity',
  'table-layout',
  'conditional-section',
  'incrementing-sequence',
  'renderer-directive',
  'parser-directive',
  'declaration-rule',
  'property-rule',
  'blocker-rule'
]);

const scopes = new Set<DynamicTemplateRuleScope>(['template', 'round', 'section', 'paragraph', 'table', 'row', 'cell', 'field', 'client-assignment']);
const states = new Set<DynamicTemplateValidationState>(['draft', 'valid', 'warning', 'blocked', 'disabled']);

export function normalizeDynamicTemplateRule(rule: Partial<DynamicTemplateRule>): DynamicTemplateRule {
  const ruleKey = String(rule.ruleKey || `${rule.ruleType || 'rule'}-${rule.sourcePath || rule.outputToken || Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120);
  return {
    id: rule.id || ruleKey,
    managerUserId: rule.managerUserId || '',
    templateAssetId: rule.templateAssetId || '',
    inspectionId: rule.inspectionId || '',
    ruleKey,
    ruleType: rule.ruleType || 'property-rule',
    ruleScope: rule.ruleScope || 'template',
    sourcePath: rule.sourcePath || null,
    sourceText: typeof rule.sourceText === 'string' ? rule.sourceText.slice(0, 2000) : null,
    canonicalField: rule.canonicalField || null,
    outputToken: rule.outputToken || null,
    preserve: Boolean(rule.preserve),
    required: Boolean(rule.required),
    enabled: rule.enabled !== false,
    priority: Number.isFinite(Number(rule.priority)) ? Math.max(1, Math.min(1000, Number(rule.priority))) : 100,
    ruleConfig: rule.ruleConfig && typeof rule.ruleConfig === 'object' ? rule.ruleConfig : {},
    validationState: rule.validationState && states.has(rule.validationState) ? rule.validationState : 'draft',
    validationReason: rule.validationReason || null
  };
}

export function validateDynamicTemplateRule(rule: Partial<DynamicTemplateRule>) {
  const normalized = normalizeDynamicTemplateRule(rule);
  if (!ruleTypes.has(normalized.ruleType)) return { ok: false, reason: 'Rule type is not supported.', rule: normalized };
  if (!scopes.has(normalized.ruleScope)) return { ok: false, reason: 'Rule scope is not supported.', rule: normalized };
  if (!normalized.ruleKey) return { ok: false, reason: 'Rule key is required.', rule: normalized };
  if (normalized.ruleType === 'canonical-field-map' && !normalized.canonicalField) return { ok: false, reason: 'Canonical field is required for mapping rules.', rule: normalized };
  if (normalized.ruleType === 'replace-variable' && !normalized.outputToken) return { ok: false, reason: 'Output token is required for replacement rules.', rule: normalized };
  if (normalized.ruleType === 'table-layout' && !normalized.ruleConfig.mode) return { ok: false, reason: 'Table layout rule requires ruleConfig.mode.', rule: normalized };
  if (normalized.ruleType === 'incrementing-sequence' && !normalized.ruleConfig.step) return { ok: false, reason: 'Incrementing sequence requires ruleConfig.step.', rule: normalized };
  if (normalized.required && normalized.enabled === false && !normalized.ruleConfig.overrideReason) return { ok: false, reason: 'Required rules cannot be disabled without ruleConfig.overrideReason.', rule: normalized };
  return { ok: true, reason: 'Rule is valid.', rule: normalized };
}
