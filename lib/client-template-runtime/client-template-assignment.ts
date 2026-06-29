import type { ClientTemplateAssignment, ClientTemplateDbClient } from './client-template-types';

export async function resolveClientTemplateAssignment(input: { supabase: ClientTemplateDbClient; clientUserId: string }): Promise<ClientTemplateAssignment> {
  const { data, error } = await input.supabase
    .from('client_template_assignments')
    .select('*')
    .eq('client_user_id', input.clientUserId)
    .eq('assignment_status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      status: 'blocked',
      managerUserId: null,
      clientUserId: input.clientUserId,
      activeTemplateAssetId: null,
      activeRoundLabel: null,
      assignmentPolicy: {},
      blocker: error.message || 'Could not load manager template assignment.'
    };
  }

  if (!data) {
    return {
      status: 'unassigned',
      managerUserId: null,
      clientUserId: input.clientUserId,
      activeTemplateAssetId: null,
      activeRoundLabel: null,
      assignmentPolicy: {},
      blocker: 'No manager-approved reusable template is assigned to this client.'
    };
  }

  return {
    status: 'assigned',
    managerUserId: String(data.manager_user_id),
    clientUserId: String(data.client_user_id),
    activeTemplateAssetId: String(data.active_template_asset_id),
    activeRoundLabel: String(data.active_round_label || '1st Round'),
    assignmentPolicy: data.assignment_policy && typeof data.assignment_policy === 'object' ? data.assignment_policy : {},
    blocker: null
  };
}

export async function resolveManagerApprovedTemplate(input: { supabase: ClientTemplateDbClient; managerUserId: string | null; templateAssetId: string | null }) {
  if (!input.managerUserId || !input.templateAssetId) return null;
  const { data, error } = await input.supabase
    .from('template_assets')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('id', input.templateAssetId)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}
