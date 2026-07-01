type QueryClient = {
  from(tableName: string): any;
};

function ownerGuard(managerUserId: string) {
  // Older rows may not have owner_id populated, but active manager templates created by the
  // current uploader write both manager_user_id and owner_id. Keep the required manager_user_id
  // equality and only allow owner_id when it is either matching or legacy-null.
  return `owner_id.eq.${managerUserId},owner_id.is.null`;
}

export async function listActiveTemplateAssets(client: QueryClient, input: { managerUserId: string; round: string | null }) {
  let query = client
    .from('template_assets')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .or(ownerGuard(input.managerUserId))
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (input.round) query = query.eq('round_label', input.round);
  return query;
}
