import { createSupabaseServerClient } from '../supabase/server';

export type SaasMetric = {
  label: string;
  value: number;
  detail: string;
};

export async function getAdminOverview() {
  const supabase = await createSupabaseServerClient();

  const [{ count: profileCount }, { count: adminCount }, { count: clientCount }, { count: caseCount }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('client_cases').select('id', { count: 'exact', head: true })
  ]);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(8);

  return {
    metrics: [
      { label: 'Users', value: profileCount || 0, detail: 'Total registered accounts' },
      { label: 'Admins', value: adminCount || 0, detail: 'Accounts with admin console access' },
      { label: 'Clients', value: clientCount || 0, detail: 'Client portal accounts' },
      { label: 'Cases', value: caseCount || 0, detail: 'Tracked workspace cases' }
    ] satisfies SaasMetric[],
    profiles: profiles || []
  };
}

export async function getClientOverview(userId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ count: caseCount }, { count: openCount }, { count: completedCount }] = await Promise.all([
    supabase.from('client_cases').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    supabase.from('client_cases').select('id', { count: 'exact', head: true }).eq('owner_id', userId).neq('status', 'completed'),
    supabase.from('client_cases').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'completed')
  ]);

  const { data: cases } = await supabase
    .from('client_cases')
    .select('id,title,status,updated_at,created_at')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
    .limit(6);

  return {
    metrics: [
      { label: 'Cases', value: caseCount || 0, detail: 'Your saved workspaces' },
      { label: 'Open', value: openCount || 0, detail: 'Still in progress' },
      { label: 'Complete', value: completedCount || 0, detail: 'Finished workflows' }
    ] satisfies SaasMetric[],
    cases: cases || []
  };
}
