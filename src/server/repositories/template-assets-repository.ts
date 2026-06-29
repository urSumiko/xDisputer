type QueryClient = {
  from(tableName: string): any;
};

export async function listActiveTemplateAssets(client: QueryClient, input: { managerUserId: string; round: string | null }) {
  let query = client
    .from('template_assets')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (input.round) query = query.eq('round_label', input.round);
  return query;
}
