import { loadEnabledDynamicTemplateRules } from '../templates/intelligence';
import { resolveClientTemplateAssignment, resolveManagerApprovedTemplate } from './client-template-assignment';
import { resolveClientOutputLimit } from './client-template-output-limit';
import { resolveReviewPacketScope } from './client-template-review-packet';
import { resolveClientCanonicalSourceData } from './client-template-source-mapping';
import type { ClientTemplateDbClient, ClientTemplateRuntimeContext } from './client-template-types';

export async function getClientTemplateRuntimeContext(input: { supabase: ClientTemplateDbClient; clientUserId: string }): Promise<ClientTemplateRuntimeContext> {
  const assignment = await resolveClientTemplateAssignment(input);
  const outputLimit = await resolveClientOutputLimit({ supabase: input.supabase, managerUserId: assignment.managerUserId, clientUserId: input.clientUserId });
  const templateAsset = await resolveManagerApprovedTemplate({ supabase: input.supabase, managerUserId: assignment.managerUserId, templateAssetId: assignment.activeTemplateAssetId });
  const sourceData = await resolveClientCanonicalSourceData({ supabase: input.supabase, managerUserId: assignment.managerUserId, clientUserId: input.clientUserId, roundLabel: assignment.activeRoundLabel });
  const rulesResult = assignment.managerUserId && assignment.activeTemplateAssetId
    ? await loadEnabledDynamicTemplateRules({ supabase: input.supabase, managerUserId: assignment.managerUserId, templateAssetId: assignment.activeTemplateAssetId })
    : { ok: true as const, rules: [] };
  const dynamicRules = rulesResult.ok ? rulesResult.rules : [];
  const packetScope = await resolveReviewPacketScope({ supabase: input.supabase, managerUserId: assignment.managerUserId, clientUserId: input.clientUserId, templateAssetId: assignment.activeTemplateAssetId, roundLabel: assignment.activeRoundLabel });
  const issues = [assignment.blocker, ...sourceData.missingRequiredFields.map((field) => `Missing source field: ${field}`), ...(rulesResult.ok ? [] : [rulesResult.error || 'Could not load manager template rules.'])].filter(Boolean) as string[];
  const managerApprovedTemplate = assignment.status === 'assigned' && Boolean(templateAsset);
  return {
    assignment,
    outputLimit,
    templateAsset,
    sourceData,
    dynamicRules,
    packetScope,
    supportingDocuments: packetScope.supportingDocuments,
    generatedFiles: packetScope.generatedFiles,
    canGenerate: managerApprovedTemplate && outputLimit.canGenerate && sourceData.sourceStatus === 'ready' && issues.length === 0,
    nextResetAt: outputLimit.nextResetAt,
    managerApprovedTemplate,
    issues,
    warnings: [...sourceData.warnings]
  };
}
