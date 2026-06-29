import { assertClientCanGenerate } from './client-template-generation-gate';
import { incrementClientOutputUsage } from './client-template-output-limit';
import { buildReviewPacketScope } from './client-template-review-packet';
import { validateSupportingDocuments } from './client-template-supporting-documents';
import type { ClientGenerationResult, ClientTemplateDbClient } from './client-template-types';

async function logClientGenerationEvent(input: { supabase: ClientTemplateDbClient; managerUserId: string | null; clientUserId: string; templateAssetId: string | null; roundLabel: string | null; status: string; executionModel?: Record<string, unknown>; generatedFiles?: Array<Record<string, unknown>>; issues?: string[]; warnings?: string[]; outputLimitSnapshot?: Record<string, unknown> }) {
  await input.supabase.from('client_generation_events').insert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, template_asset_id: input.templateAssetId, round_label: input.roundLabel, generation_status: input.status, execution_model: input.executionModel || {}, generated_files: input.generatedFiles || [], issues: input.issues || [], warnings: input.warnings || [], output_limit_snapshot: input.outputLimitSnapshot || {}, updated_at: new Date().toISOString() });
}

function buildGeneratedFilePreview(input: { templateAssetId: string; roundLabel: string; injectedCount: number }) {
  return [{ kind: 'letter-preview', templateAssetId: input.templateAssetId, roundLabel: input.roundLabel, storagePath: null, reviewStatus: 'draft', generatedAt: new Date().toISOString(), summary: `${input.roundLabel} manager-approved letter preview with ${input.injectedCount} injected field(s).` }];
}

export async function generateClientLettersFromManagerTemplate(input: { supabase: ClientTemplateDbClient; clientUserId: string }): Promise<ClientGenerationResult> {
  const gate = await assertClientCanGenerate(input);
  if (!gate.ok) {
    await logClientGenerationEvent({ supabase: input.supabase, managerUserId: gate.context?.assignment.managerUserId || null, clientUserId: input.clientUserId, templateAssetId: gate.context?.assignment.activeTemplateAssetId || null, roundLabel: gate.context?.assignment.activeRoundLabel || null, status: 'blocked', issues: gate.issues || gate.missingFields || [gate.reason || 'Generation is not ready.'] });
    return { ok: false, code: gate.code, reason: gate.reason, issues: gate.issues || gate.missingFields || [], nextResetAt: gate.context?.outputLimit.nextResetAt };
  }

  const assignment = gate.context.assignment;
  const packet = await buildReviewPacketScope({ supabase: input.supabase, managerUserId: assignment.managerUserId!, clientUserId: input.clientUserId, templateAssetId: assignment.activeTemplateAssetId!, roundLabel: assignment.activeRoundLabel!, appliedRules: gate.appliedRules, outputLimitSnapshot: gate.context.outputLimit });
  const supportingCheck = validateSupportingDocuments({ packetScope: packet.packet_scope || {}, supportingDocuments: gate.context.supportingDocuments || [] });
  if (!supportingCheck.ok) {
    return { ok: false, code: 'SUPPORTING_DOCUMENTS_MISSING', reason: supportingCheck.reason, issues: supportingCheck.missing, nextResetAt: gate.context.outputLimit.nextResetAt };
  }

  const generatedFiles = buildGeneratedFilePreview({ templateAssetId: assignment.activeTemplateAssetId!, roundLabel: assignment.activeRoundLabel!, injectedCount: gate.appliedRules.injected.length });
  const nextLimit = await incrementClientOutputUsage({ supabase: input.supabase, managerUserId: assignment.managerUserId!, clientUserId: input.clientUserId, generatedCount: generatedFiles.length });
  await logClientGenerationEvent({ supabase: input.supabase, managerUserId: assignment.managerUserId!, clientUserId: input.clientUserId, templateAssetId: assignment.activeTemplateAssetId!, roundLabel: assignment.activeRoundLabel!, status: 'generated', generatedFiles, executionModel: { appliedRules: gate.appliedRules, packetScope: packet.packet_scope }, warnings: gate.appliedRules.warnings, outputLimitSnapshot: nextLimit });
  return { ok: true, generatedFiles, packetScope: packet.packet_scope || {}, warnings: gate.appliedRules.warnings, nextResetAt: nextLimit.nextResetAt };
}
