import type { createSupabaseServerClient } from '../supabase/server';
import type { ManagedAccount } from './account-management';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DirectoryView = 'all' | 'pending' | 'active' | 'blocked' | 'managers' | 'clients';

export type AccountDirectoryRow = ManagedAccount & {
  total_count?: number;
  workspace_id?: string;
  workspace_role?: string;
  membership_status?: string;
  assignment_status?: string | null;
  primary_manager_email?: string | null;
};

type WorkspaceDirectoryRpcRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ManagedAccount['role'];
  account_status: ManagedAccount['account_status'];
  manager_id: string | null;
  manager_invite_code: string | null;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  workspace_role: string;
  membership_status: string;
  assignment_status: string | null;
  primary_manager_email: string | null;
  total_count?: number;
};

export type AccountDirectorySummary = {
  total: number;
  pending: number;
  active: number;
  blocked: number;
  managers: number;
  clients: number;
  linked: number;
  unassigned: number;
};

export type AccountDirectoryOptions = {
  view: DirectoryView;
  query?: string;
  page?: number;
  pageSize?: number;
};

export type AccountDirectoryListResult = {
  accounts: AccountDirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  errorMessage: string | null;
};

const CONTROL_DIRECTORY_DEFAULT_PAGE_SIZE = 20;
const CONTROL_DIRECTORY_MAX_PAGE_SIZE = 25;

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function isMissingRpcError(message: string | null | undefined) {
  return Boolean(
    message && (
      message.includes('Could not find the function') ||
      message.includes('does not exist') ||
      message.includes('schema cache')
    )
  );
}

export function normalizeDirectoryParams(params?: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const viewInput = first(params?.view) || 'overview';

  return {
    view: viewInput,
    query: (first(params?.q) || '').trim().slice(0, 120),
    page: safeNumber(first(params?.page), 1),
    pageSize: Math.min(CONTROL_DIRECTORY_MAX_PAGE_SIZE, Math.max(10, safeNumber(first(params?.pageSize), CONTROL_DIRECTORY_DEFAULT_PAGE_SIZE)))
  };
}

export function directoryQueryString(input: { view?: string; q?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams();

  if (input.view) params.set('view', input.view);
  if (input.q) params.set('q', input.q);
  if (input.page && input.page > 1) params.set('page', String(input.page));
  if (input.pageSize && input.pageSize !== CONTROL_DIRECTORY_DEFAULT_PAGE_SIZE) params.set('pageSize', String(input.pageSize));

  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeAccount(row: AccountDirectoryRow): AccountDirectoryRow {
  return {
    ...row,
    role: row.role === 'admin' ? 'manager' : row.role,
    account_status: row.account_status || 'active'
  };
}

function mapWorkspaceRow(row: WorkspaceDirectoryRpcRow): AccountDirectoryRow {
  return normalizeAccount({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role === 'admin' ? 'manager' : row.role,
    account_status: row.account_status,
    manager_id: row.manager_id,
    manager_invite_code: row.manager_invite_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_count: Number(row.total_count || 0),
    workspace_id: row.workspace_id,
    workspace_role: row.workspace_role,
    membership_status: row.membership_status,
    assignment_status: row.assignment_status,
    primary_manager_email: row.primary_manager_email
  });
}

function mapWorkspaceSummary(row: Record<string, unknown> | null): AccountDirectorySummary {
  return {
    total: Number(row?.total_users || 0),
    pending: Number(row?.pending_clients || 0),
    active: Number(row?.active_clients || 0),
    blocked: Number(row?.blocked_accounts || 0),
    managers: Number(row?.manager_accounts || 0),
    clients: Number(row?.client_accounts || 0),
    linked: Number(row?.linked_clients || 0),
    unassigned: Number(row?.unassigned_clients || 0)
  };
}

async function getWorkspaceAccountSummary(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.rpc('access_workspace_account_summary_v1', {
    workspace_id_input: null
  });

  const row = Array.isArray(data) ? data[0] : null;

  return {
    summary: mapWorkspaceSummary(row),
    errorMessage: error?.message || null
  };
}

async function listWorkspaceAccountDirectory(
  supabase: SupabaseServerClient,
  options: AccountDirectoryOptions
): Promise<AccountDirectoryListResult> {
  const pageSize = Math.min(CONTROL_DIRECTORY_MAX_PAGE_SIZE, Math.max(10, options.pageSize || CONTROL_DIRECTORY_DEFAULT_PAGE_SIZE));
  const { data, error } = await supabase.rpc('access_workspace_account_directory_v1', {
    workspace_id_input: null,
    view_input: options.view,
    search_input: options.query || null,
    page_input: options.page || 1,
    page_size_input: pageSize
  });

  const accounts = Array.isArray(data) ? (data as WorkspaceDirectoryRpcRow[]).map(mapWorkspaceRow) : [];
  const total = Number(accounts[0]?.total_count || 0);

  return {
    accounts,
    total,
    page: options.page || 1,
    pageSize,
    errorMessage: error?.message || null
  };
}

async function listWorkspaceAttentionQueue(
  supabase: SupabaseServerClient,
  limit = 5
): Promise<AccountDirectoryListResult> {
  const { data, error } = await supabase.rpc('access_workspace_attention_queue_v1', {
    workspace_id_input: null,
    limit_input: limit
  });

  if (!error) {
    const accounts = Array.isArray(data) ? (data as WorkspaceDirectoryRpcRow[]).map(mapWorkspaceRow) : [];

    return {
      accounts,
      total: Number(accounts[0]?.total_count || 0),
      page: 1,
      pageSize: limit,
      errorMessage: null
    };
  }

  if (!isMissingRpcError(error.message)) {
    return {
      accounts: [],
      total: 0,
      page: 1,
      pageSize: limit,
      errorMessage: error.message
    };
  }

  const [pending, blocked] = await Promise.all([
    listWorkspaceAccountDirectory(supabase, { view: 'pending', page: 1, pageSize: limit }),
    listWorkspaceAccountDirectory(supabase, { view: 'blocked', page: 1, pageSize: limit })
  ]);

  return {
    accounts: [...blocked.accounts, ...pending.accounts].slice(0, limit),
    total: pending.total + blocked.total,
    page: 1,
    pageSize: limit,
    errorMessage: pending.errorMessage || blocked.errorMessage
  };
}

export async function getManagerClientSummary(supabase: SupabaseServerClient): Promise<{
  summary: AccountDirectorySummary;
  errorMessage: string | null;
}> {
  const result = await getWorkspaceAccountSummary(supabase);

  return {
    summary: {
      ...result.summary,
      managers: 0,
      total: result.summary.clients
    },
    errorMessage: result.errorMessage
  };
}

export async function listManagerClientDirectory(
  supabase: SupabaseServerClient,
  options: AccountDirectoryOptions
) {
  return listWorkspaceAccountDirectory(supabase, {
    ...options,
    view: options.view === 'all' ? 'clients' : options.view
  });
}

export async function listManagerAttentionQueue(supabase: SupabaseServerClient, limit = 5) {
  return listWorkspaceAttentionQueue(supabase, limit);
}

export async function getMasterAccountSummary(supabase: SupabaseServerClient): Promise<{
  summary: AccountDirectorySummary;
  errorMessage: string | null;
}> {
  return getWorkspaceAccountSummary(supabase);
}

export async function listMasterAccountDirectory(
  supabase: SupabaseServerClient,
  options: AccountDirectoryOptions
) {
  return listWorkspaceAccountDirectory(supabase, options);
}

export async function listMasterAttentionQueue(supabase: SupabaseServerClient, limit = 5) {
  return listWorkspaceAttentionQueue(supabase, limit);
}
