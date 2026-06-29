import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type WorkspaceActorContext = {
  actor_id: string;
  actor_email: string | null;
  platform_role: string;
  workspace_id: string;
  workspace_role: string;
  member_scope: string;
  is_platform_master: boolean;
  is_workspace_master: boolean;
  is_manager: boolean;
  is_client: boolean;
  can_manage_accounts: boolean;
  can_manage_managers: boolean;
  can_manage_clients: boolean;
  can_view_system: boolean;
};

export type WorkspaceDirectoryRow = {
  profile_id: string;
  email: string | null;
  full_name: string | null;
  platform_role: string;
  account_status: string | null;
  workspace_id: string;
  workspace_role: string;
  member_scope: string;
  membership_status: string;
  primary_manager_id: string | null;
  primary_manager_email: string | null;
  assignment_status: string | null;
  created_at: string;
  total_count: number;
};

export type WorkspaceDirectoryOptions = {
  workspaceId?: string | null;
  view?: string | null;
  query?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeWorkspaceDirectoryParams(params: Record<string, string | string[] | undefined>) {
  const rawView = firstString(params.view);
  const rawQuery = firstString(params.query);
  const rawPage = Number(firstString(params.page) || '1');
  const rawPageSize = Number(firstString(params.pageSize) || '25');

  const allowedViews = new Set(['all', 'masters', 'managers', 'clients', 'pending', 'blocked']);

  return {
    view: allowedViews.has(rawView || '') ? rawView || 'all' : 'all',
    query: rawQuery?.trim() || '',
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
    pageSize: Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 25
  };
}

export function workspaceDirectoryQueryString(options: WorkspaceDirectoryOptions) {
  const params = new URLSearchParams();

  if (options.view && options.view !== 'all') params.set('view', options.view);
  if (options.query) params.set('query', options.query);
  if (options.page && options.page > 1) params.set('page', String(options.page));
  if (options.pageSize && options.pageSize !== 25) params.set('pageSize', String(options.pageSize));

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function getWorkspaceActorContext(
  supabase: SupabaseServerClient,
  workspaceId?: string | null
) {
  const { data, error } = await supabase.rpc('access_get_actor_context', {
    workspace_id_input: workspaceId || null
  });

  return {
    context: Array.isArray(data) && data[0] ? data[0] as WorkspaceActorContext : null,
    errorMessage: error?.message || null
  };
}

export async function listWorkspaceAccountDirectory(
  supabase: SupabaseServerClient,
  options: WorkspaceDirectoryOptions = {}
) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(options.pageSize || 25, 100));

  const { data, error } = await supabase.rpc('access_workspace_account_directory', {
    workspace_id_input: options.workspaceId || null,
    view_input: options.view || 'all',
    search_input: options.query || null,
    page_input: page,
    page_size_input: pageSize
  });

  const rows = Array.isArray(data) ? data as WorkspaceDirectoryRow[] : [];
  const totalCount = rows[0]?.total_count || 0;

  return {
    rows,
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    errorMessage: error?.message || null
  };
}
