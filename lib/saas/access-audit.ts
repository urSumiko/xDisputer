import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AccessAuditEvent = {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  target_email: string | null;
  target_role: string | null;
  manager_id: string | null;
  event_type: string;
  event_detail: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export async function listAccessAuditEvents(
  supabase: SupabaseServerClient,
  scope: 'manager' | 'master',
  limit = 100
) {
  const rpcName = scope === 'master'
    ? 'access_list_master_audit_events'
    : 'access_list_manager_audit_events';

  const { data, error } = await supabase.rpc(rpcName, {
    limit_count: limit
  });

  return {
    events: Array.isArray(data) ? (data as AccessAuditEvent[]) : [],
    errorMessage: error?.message || null
  };
}

export function readableAuditEventType(value: string) {
  return value
    .replace(/^manager_/, 'manager ')
    .replace(/^master_/, 'master ')
    .replace(/^client_/, 'client ')
    .replace(/_/g, ' ');
}
