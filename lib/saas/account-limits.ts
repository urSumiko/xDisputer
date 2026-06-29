import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AccountLimitSnapshot = {
  profile_id: string;
  role: 'master' | 'manager' | 'client' | string;
  manager_client_limit: number;
  manager_active_clients: number;
  manager_client_remaining: number;
  client_output_limit: number;
  client_successful_outputs: number;
  client_output_remaining: number;
};

export type AccountLimitMap = Record<string, AccountLimitSnapshot>;

function normalizeLimitRow(row: Record<string, unknown>): AccountLimitSnapshot {
  return {
    profile_id: String(row.profile_id || ''),
    role: String(row.role || 'client'),
    manager_client_limit: Number(row.manager_client_limit || 0),
    manager_active_clients: Number(row.manager_active_clients || 0),
    manager_client_remaining: Number(row.manager_client_remaining || 0),
    client_output_limit: Number(row.client_output_limit || 0),
    client_successful_outputs: Number(row.client_successful_outputs || 0),
    client_output_remaining: Number(row.client_output_remaining || 0)
  };
}

export async function listAccountLimitSnapshots(
  supabase: SupabaseServerClient,
  profileIds: string[]
): Promise<{ limits: AccountLimitMap; errorMessage: string | null }> {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return { limits: {}, errorMessage: null };
  }

  const { data, error } = await supabase.rpc('access_account_limit_snapshot_v1', {
    profile_ids: uniqueIds
  });

  if (error) {
    return { limits: {}, errorMessage: error.message };
  }

  const limits = (Array.isArray(data) ? data : []).reduce<AccountLimitMap>((accumulator, row) => {
    const normalized = normalizeLimitRow(row as Record<string, unknown>);
    if (normalized.profile_id) accumulator[normalized.profile_id] = normalized;
    return accumulator;
  }, {});

  return { limits, errorMessage: null };
}

export async function getOwnAccountLimitSnapshot(
  supabase: SupabaseServerClient,
  profileId: string
): Promise<{ limit: AccountLimitSnapshot | null; errorMessage: string | null }> {
  const result = await listAccountLimitSnapshots(supabase, [profileId]);

  return {
    limit: result.limits[profileId] || null,
    errorMessage: result.errorMessage
  };
}

export function formatManagerClientLimit(limit?: AccountLimitSnapshot) {
  if (!limit) return 'Default limit';
  return `${limit.manager_active_clients}/${limit.manager_client_limit} clients`;
}

export function formatClientOutputLimit(limit?: AccountLimitSnapshot) {
  if (!limit) return 'Default limit';
  return `${limit.client_successful_outputs}/${limit.client_output_limit} outputs`;
}
