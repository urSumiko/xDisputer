import { getClientTemplateRuntimeContext } from './client-template-context';
import { applyManagerRulesToClientData } from './client-template-rule-application';
import type { ClientTemplateDbClient } from './client-template-types';

export async function assertClientCanGenerate(input: { supabase: ClientTemplateDbClient; clientUserId: string }) {
  const context = await getClientTemplateRuntimeContext(input);
  if (context.assignment.status !== 'assigned') return { ok: false as const, code: 'NO_MANAGER_TEMPLATE_ASSIGNMENT', reason: context.assignment.blocker || 'No manager-approved reusable template is assigned.', context };
  if (!context.outputLimit.canGenerate) return { ok: false as const, code: 'DAILY_OUTPUT_LIMIT_REACHED', reason: 'Daily Output Limit reached.', nextResetAt: context.outputLimit.nextResetAt, context };
  if (!context.templateAsset) return { ok: false as const, code: 'MANAGER_TEMPLATE_NOT_ACTIVE', reason: 'Assigned manager template is not active.', context };
  if (context.sourceData.sourceStatus !== 'ready') return { ok: false as const, code: 'SOURCE_DATA_NOT_READY', reason: 'Client source data has missing required canonical fields.', missingFields: context.sourceData.missingRequiredFields, context };
  const appliedRules = applyManagerRulesToClientData({ rules: context.dynamicRules, canonicalData: context.sourceData.canonicalData });
  if (!appliedRules.ready) return { ok: false as const, code: 'MANAGER_TEMPLATE_RULES_NOT_READY', reason: 'Manager-approved template rules are not satisfied.', issues: appliedRules.issues, context, appliedRules };
  return { ok: true as const, context, appliedRules };
}
