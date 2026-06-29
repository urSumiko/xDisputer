import type { AppliedClientTemplateRules, ClientReviewPacketScope, ClientTemplateDbClient } from './client-template-types';

export async function resolveReviewPacketScope(input: { supabase: ClientTemplateDbClient; managerUserId: string | null; clientUserId: string; templateAssetId: string | null; roundLabel: string | null }): Promise<ClientReviewPacketScope> {
  if (!input.managerUserId || !input.templateAssetId || !input.roundLabel) {
    return { managerUserId: input.managerUserId, clientUserId: input.clientUserId, templateAssetId: input.templateAssetId, roundLabel: input.roundLabel, packetScope: {}, supportingDocuments: [], generatedFiles: [], reviewStatus: 'blocked' };
  }
  const { data } = await input.supabase
    .from('client_review_packet_scopes')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('client_user_id', input.clientUserId)
    .eq('template_asset_id', input.templateAssetId)
    .eq('round_label', input.roundLabel)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { managerUserId: input.managerUserId, clientUserId: input.clientUserId, templateAssetId: input.templateAssetId, roundLabel: input.roundLabel, packetScope: { requiredSections: ['source-data-review', 'manager-template-preview', 'supporting-documents', 'generated-files'] }, supportingDocuments: [], generatedFiles: [], reviewStatus: 'draft' };
  return { managerUserId: String(data.manager_user_id), clientUserId: String(data.client_user_id), templateAssetId: String(data.template_asset_id), roundLabel: String(data.round_label), packetScope: data.packet_scope || {}, supportingDocuments: Array.isArray(data.supporting_documents) ? data.supporting_documents : [], generatedFiles: Array.isArray(data.generated_files) ? data.generated_files : [], reviewStatus: data.review_status || 'draft' };
}

export async function buildReviewPacketScope(input: { supabase: ClientTemplateDbClient; managerUserId: string; clientUserId: string; templateAssetId: string; roundLabel: string; appliedRules: AppliedClientTemplateRules; outputLimitSnapshot?: Record<string, unknown> }) {
  const packetScope = { roundLabel: input.roundLabel, templateAssetId: input.templateAssetId, requiredSections: ['source-data-review', 'manager-template-preview', 'preserved-static-text', 'injected-fields', 'supporting-documents', 'generated-files'], preservedStaticText: input.appliedRules.preserved, injectedFields: input.appliedRules.injected, issues: input.appliedRules.issues, readyForGeneration: input.appliedRules.ready, outputLimitSnapshot: input.outputLimitSnapshot || {} };
  const { data, error } = await input.supabase
    .from('client_review_packet_scopes')
    .insert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, template_asset_id: input.templateAssetId, round_label: input.roundLabel, packet_scope: packetScope, supporting_documents: [], generated_files: [], review_status: input.appliedRules.ready ? 'ready' : 'blocked' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}
