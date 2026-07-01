import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type Row = { manager_id?: unknown };

export async function listLiveManagerSeatCounts(supabase: SupabaseServerClient, managerIds: string[]) {
  const ids = Array.from(new Set(managerIds.filter(Boolean)));
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, 0));
  if (!ids.length) return counts;

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
