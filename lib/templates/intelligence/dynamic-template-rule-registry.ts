import type { DynamicTemplateDbClient, DynamicTemplateRule } from './dynamic-template-types';
import { normalizeDynamicTemplateRule, validateDynamicTemplateRule } from './dynamic-template-rule-validation';

type DynamicTemplateRuleLoadResult =
  | { ok: true; error: null; rules: DynamicTemplateRule[] }
  | { ok: false; error: string; rules: DynamicTemplateRule[] };

function toDbRule(rule: DynamicTemplateRule) {
  return {
    manager_user_id: rule.managerUserId,
    template_asset_id: rule.templateAssetId,
    inspection_id: rule.inspectionId || null,
    rule_key: rule.ruleKey,
    rule_type: rule.ruleType,
    rule_scope: rule.ruleScope,
    source_path: rule.sourcePath || null,
    source_text: rule.sourceText || null,
    canonical_field: rule.canonicalField || null,
    output_token: rule.outputToken || null,
    preserve: rule.preserve,
    required: rule.required,
    enabled: rule.enabled,
    priority: rule.priority,
    rule_config: rule.ruleConfig,
    validation_state: rule.validationState,
    validation_reason: rule.validationReason || null,
    updated_by: rule.managerUserId,
    updated_at: new Date().toISOString()
  };
}

function fromDbRule(row: Record<string, unknown>): DynamicTemplateRule {
  return {
    id: String(row.id || row.rule_key || ''),
    managerUserId: String(row.manager_user_id || ''),
    templateAssetId: String(row.template_asset_id || ''),
    inspectionId: String(row.inspection_id || ''),
    ruleKey: String(row.rule_key || ''),
    ruleType: row.rule_type as DynamicTemplateRule['ruleType'],
    ruleScope: row.rule_scope as DynamicTemplateRule['ruleScope'],
    sourcePath: String(row.source_path || '') || null,
    sourceText: String(row.source_text || '') || null,
    canonicalField: String(row.canonical_field || '') || null,
    outputToken: String(row.output_token || '') || null,
    preserve: Boolean(row.preserve),
    required: Boolean(row.required),
    enabled: row.enabled !== false,
    priority: Number(row.priority || 100),
    ruleConfig: row.rule_config && typeof row.rule_config === 'object' ? row.rule_config as Record<string, unknown> : {},
    validationState: (row.validation_state || 'draft') as DynamicTemplateRule['validationState'],
    validationReason: String(row.validation_reason || '') || null
  };
}

export async function loadEnabledDynamicTemplateRules(input: { supabase: DynamicTemplateDbClient; managerUserId: string; templateAssetId: string }): Promise<DynamicTemplateRuleLoadResult> {
  const { data, error } = await input.supabase.from('dynamic_template_rules').select('*').eq('manager_user_id', input.managerUserId).eq('template_asset_id', input.templateAssetId).eq('enabled', true).order('priority', { ascending: true });
  if (error) return { ok: false, error: String(error.message || error), rules: [] };
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
  return { ok: true, error: null, rules: rows.map(fromDbRule) };
}

export async function createDynamicTemplateRule(input: { supabase: DynamicTemplateDbClient; managerUserId: string; templateAssetId: string; inspectionId: string; rule: Partial<DynamicTemplateRule> }) {
  const normalized = normalizeDynamicTemplateRule({ ...input.rule, managerUserId: input.managerUserId, templateAssetId: input.templateAssetId, inspectionId: input.inspectionId });
  const validation = validateDynamicTemplateRule(normalized);
  if (!validation.ok) return { ok: false as const, error: validation.reason, rule: normalized };
  const { data, error } = await input.supabase.from('dynamic_template_rules').upsert(toDbRule(normalized), { onConflict: 'template_asset_id,rule_key' }).select('*').single();
  if (error) return { ok: false as const, error: String(error.message || error), rule: normalized };
  return { ok: true as const, data: fromDbRule(data as Record<string, unknown>), rule: normalized };
}

export async function updateDynamicTemplateRule(input: { supabase: DynamicTemplateDbClient; managerUserId: string; ruleId: string; patch: Partial<DynamicTemplateRule> }) {
  const { data: existing, error: loadError } = await input.supabase.from('dynamic_template_rules').select('*').eq('manager_user_id', input.managerUserId).eq('id', input.ruleId).single();
  if (loadError || !existing) return { ok: false as const, error: String(loadError?.message || 'Rule not found.') };
  const merged = normalizeDynamicTemplateRule({ ...fromDbRule(existing as Record<string, unknown>), ...input.patch, managerUserId: input.managerUserId });
  const validation = validateDynamicTemplateRule(merged);
  if (!validation.ok) return { ok: false as const, error: validation.reason, rule: merged };
  const { data, error } = await input.supabase.from('dynamic_template_rules').update(toDbRule(merged)).eq('manager_user_id', input.managerUserId).eq('id', input.ruleId).select('*').single();
  if (error) return { ok: false as const, error: String(error.message || error), rule: merged };
  return { ok: true as const, data: fromDbRule(data as Record<string, unknown>), rule: merged };
}
