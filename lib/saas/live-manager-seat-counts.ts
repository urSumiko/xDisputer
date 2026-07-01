import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type Row = { manager_id?: unknown };
type RpcRow = { profile_id?: unknown; current_clients?: unknown };

function isMissingRpc(message: string | undefined) {
  return Boolean(message && (message.includes('Could not find the function') || message.includes('does not exist') || message.includes('schema cache')));
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listLiveManagerSeatCounts(supabase: SupabaseServerClient, managerIds: string[]) {
  const ids = Array.from(new Set(managerIds.filter(Boolean)));
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, 0));
  if (!ids.length) return counts;

  const repaired = await supabase.rpc('access_manager_live_seat_counts_v1', { profile_ids: ids });
  if (!repaired.error && Array.isArray(repaired.data)) {
    for (const row of repaired.data as RpcRow[]) {
      const id = String(row.profile_id || '');
      if (id) counts.set(id, numberValue(row.current_clients));
    }
    return counts;
  }

  if (repaired.error && !isMissingRpc(repaired.error.message)) return counts;

  const { data, error } = await supabase
    .from('profiles')
    .select('manager_id')
    .eq('role', 'client')
    .in('manager_id', ids)
    .in('account_status', ['active', 'pending_manager_approval']);

  if (error || !Array.isArray(data)) return counts;

  for (const row of data as Row[]) {
    const managerId = String(row.manager_id || '');
    if (managerId) counts.set(managerId, (counts.get(managerId) || 0) + 1);
  }

  return counts;
}
