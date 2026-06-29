import type { DynamicTemplateAssetInput, DynamicTemplateDbClient, DynamicTemplateInspectionResult } from './dynamic-template-types';
import { inspectDynamicTemplateFromAsset } from './dynamic-template-inspector';
import { classifyFindingsToRules } from './dynamic-template-rule-classifier';
import { createDynamicTemplateRule } from './dynamic-template-rule-registry';

async function loadAsset(input: { supabase: DynamicTemplateDbClient; managerUserId: string; templateAssetId: string }): Promise<DynamicTemplateAssetInput | null> {
  const { data, error } = await input.supabase
    .from('template_assets')
    .select('id, manager_user_id, round_label, original_filename, mime_type, validation_json, contract_json, rule_json')
    .eq('manager_user_id', input.managerUserId)
    .eq('id', input.templateAssetId)
    .single();
  if (error || !data) return null;
  return data as DynamicTemplateAssetInput;
}

async function storeInspection(input: { supabase: DynamicTemplateDbClient; inspection: DynamicTemplateInspectionResult }) {
  const payload = {
    manager_user_id: input.inspection.managerUserId,
    template_asset_id: input.inspection.templateAssetId,
    round_label: input.inspection.roundLabel,
    inspection_status: input.inspection.status,
    detected_summary: {
      staticText: input.inspection.staticTextBlocks.length,
      variables: input.inspection.variables.length,
      entities: input.inspection.entities.length,
      mappedFields: input.inspection.mappedFields.length,
      tables: input.inspection.tableLayouts.length,
      suggestedRules: input.inspection.suggestedRules.length
    },
    static_text_blocks: input.inspection.staticTextBlocks,
    variables: input.inspection.variables,
    entities: input.inspection.entities,
    mapped_fields: input.inspection.mappedFields,
    table_layouts: input.inspection.tableLayouts,
    parser_findings: input.inspection.parserFindings,
    renderer_findings: input.inspection.rendererFindings,
    blockers: input.inspection.blockers,
    warnings: input.inspection.warnings,
    updated_at: new Date().toISOString()
  };
  return input.supabase
    .from('dynamic_template_inspections')
    .upsert(payload, { onConflict: 'template_asset_id' })
    .select('id')
    .single();
}

export async function inspectAndStoreDynamicTemplate(input: {
  supabase: DynamicTemplateDbClient;
  managerUserId: string;
  templateAssetId: string;
  asset?: DynamicTemplateAssetInput;
}) {
  const asset = input.asset || await loadAsset(input);
  if (!asset) return { ok: false as const, error: 'Template asset was not found.' };
  const inspection = inspectDynamicTemplateFromAsset(asset);
  const stored = await storeInspection({ supabase: input.supabase, inspection });
  if (stored.error) return { ok: false as const, error: String(stored.error.message || stored.error), inspection };
  const inspectionId = String(stored.data?.id || '');
  const rules = classifyFindingsToRules({ findings: inspection.suggestedRules, managerUserId: input.managerUserId, templateAssetId: input.templateAssetId, inspectionId });
  const results = await Promise.all(rules.map((rule) => createDynamicTemplateRule({ supabase: input.supabase, managerUserId: input.managerUserId, templateAssetId: input.templateAssetId, inspectionId, rule })));
  const failed = results.filter((result) => !result.ok).map((result) => 'error' in result ? result.error : 'Rule save failed.');
  return { ok: failed.length === 0, error: failed[0] || null, inspection, inspectionId, rulesCreated: results.length - failed.length, rulesFailed: failed.length };
}

export async function loadLatestDynamicTemplateInspection(input: { supabase: DynamicTemplateDbClient; managerUserId: string; templateAssetId: string }) {
  const { data, error } = await input.supabase
    .from('dynamic_template_inspections')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('template_asset_id', input.templateAssetId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false as const, inspection: null, error: error ? String(error.message || error) : 'No inspection found.' };
  return { ok: true as const, inspection: data as Record<string, unknown>, error: null };
}
