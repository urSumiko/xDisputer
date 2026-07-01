import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type EntitlementLimitRow = {
  profile_id: string;
  max_clients: number | null;
  current_clients: number;
  default_client_output_limit: number | null;
  client_output_limit: number | null;
  effective_output_limit: number | null;
  output_used_today: number;
  output_remaining_today: number | null;
  updated_at: string | null;
};

export type EntitlementLimitMap = Record<string, EntitlementLimitRow>;

type RawEntitlementRow = Partial<Record<keyof EntitlementLimitRow, unknown>> & {
  output_used_this_month?: unknown;
  output_remaining_this_month?: unknown;
  entitlement_notes?: string | null;
};

type RawManagerLimitRow = {
  manager_id?: unknown;
  max_clients?: unknown;
  default_client_output_limit?: unknown;
  updated_at?: unknown;
};

type RawOutputUsageRow = {
  disputer_id?: unknown;
  owner_id?: unknown;
  output_count?: unknown;
  status?: unknown;
  output_status?: unknown;
};

function isMissingRpc(message: string) {
  return message.includes('Could not find the function')
    || message.includes('does not exist')
    || message.includes('schema cache');
}

function numericValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function positiveOrNull(value: unknown) {
  const parsed = numericValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonnegativeOrNull(value: unknown) {
  const parsed = numericValue(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function dateStringOrNull(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function emptyRow(profileId: string): EntitlementLimitRow {
  return { profile_id: profileId, max_clients: null, current_clients: 0, default_client_output_limit: null, client_output_limit: null, effective_output_limit: null, output_used_today: 0, output_remaining_today: null, updated_at: null };
}

function normalizeRow(row: RawEntitlementRow): EntitlementLimitRow {
  const effectiveLimit = positiveOrNull(row.effective_output_limit);
  const usedToday = nonnegativeOrNull(row.output_used_today ?? row.output_used_this_month) ?? 0;
  return {
    profile_id: String(row.profile_id || ''),
    max_clients: positiveOrNull(row.max_clients),
    current_clients: nonnegativeOrNull(row.current_clients) ?? 0,
    default_client_output_limit: positiveOrNull(row.default_client_output_limit),
    client_output_limit: positiveOrNull(row.client_output_limit),
    effective_output_limit: effectiveLimit,
    output_used_today: usedToday,
    output_remaining_today: effectiveLimit === null ? null : nonnegativeOrNull(row.output_remaining_today ?? row.output_remaining_this_month),
    updated_at: dateStringOrNull(row.updated_at)
  };
}

function mergeRow(base: EntitlementLimitRow | undefined, incoming: EntitlementLimitRow) {
  const current = base || emptyRow(incoming.profile_id);
  const effectiveLimit = incoming.effective_output_limit ?? current.effective_output_limit;
  const outputUsedToday = Math.max(current.output_used_today || 0, incoming.output_used_today || 0);
  const incomingRemaining = incoming.output_remaining_today ?? current.output_remaining_today;
  return {
    profile_id: current.profile_id || incoming.profile_id,
    max_clients: incoming.max_clients ?? current.max_clients,
    current_clients: Math.max(current.current_clients || 0, incoming.current_clients || 0),
    default_client_output_limit: incoming.default_client_output_limit ?? current.default_client_output_limit,
    client_output_limit: incoming.client_output_limit ?? current.client_output_limit,
    effective_output_limit: effectiveLimit,
    output_used_today: outputUsedToday,
    output_remaining_today: effectiveLimit === null ? incomingRemaining : Math.max(effectiveLimit - outputUsedToday, 0),
    updated_at: incoming.updated_at || current.updated_at
  } satisfies EntitlementLimitRow;
}

async function callEntitlementRpc(
  supabase: SupabaseServerClient,
  rpcName: string,
  ids: string[]
) {
  return supabase.rpc(rpcName, { profile_ids: ids });
}

async function readRpcRows(supabase: SupabaseServerClient, rpcName: string, ids: string[]) {
  const { data, error } = await callEntitlementRpc(supabase, rpcName, ids);
  if (error) return { rows: [] as EntitlementLimitRow[], errorMessage: isMissingRpc(error.message) ? null : error.message, missing: isMissingRpc(error.message) };
  const rows = Array.isArray(data) ? (data as RawEntitlementRow[]).map(normalizeRow).filter((row) => row.profile_id) : [];
  return { rows, errorMessage: null, missing: false };
}

async function readManagerLimitTableRows(supabase: SupabaseServerClient, ids: string[]) {
  const { data, error } = await supabase
    .from('manager_entitlement_limits')
    .select('manager_id,max_clients,default_client_output_limit,updated_at')
    .in('manager_id', ids);
  if (error || !Array.isArray(data)) return [] as EntitlementLimitRow[];
  return (data as RawManagerLimitRow[]).map((row) => {
    const profileId = String(row.manager_id || '');
    const maxClients = positiveOrNull(row.max_clients);
    const defaultOutput = positiveOrNull(row.default_client_output_limit);
    return {
      ...emptyRow(profileId),
      max_clients: maxClients,
      default_client_output_limit: defaultOutput,
      effective_output_limit: defaultOutput,
      updated_at: dateStringOrNull(row.updated_at)
    };
  }).filter((row) => row.profile_id);
}

function todayUtcWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function outputStatusCounts(status: unknown) {
  const value = String(status || '').toLowerCase();
  return !value || value === 'generated' || value === 'downloaded' || value === 'recorded' || value === 'pending' || value === 'approved' || value === 'paid';
}

function addUsage(map: Map<string, number>, profileId: string, amount: unknown) {
  if (!profileId) return;
  const count = Math.max(1, nonnegativeOrNull(amount) ?? 1);
  map.set(profileId, (map.get(profileId) || 0) + count);
}

async function readTodayOutputUsageRows(supabase: SupabaseServerClient, ids: string[]) {
  const { start, end } = todayUtcWindow();
  const approvalUsage = new Map<string, number>();
  const generationUsage = new Map<string, number>();

  const approvals = await supabase
    .from('manager_disputer_output_approvals')
    .select('disputer_id,output_count,status,created_at')
    .in('disputer_id', ids)
    .gte('created_at', start)
    .lt('created_at', end);

  if (!approvals.error && Array.isArray(approvals.data)) {
    for (const row of approvals.data as RawOutputUsageRow[]) {
      if (outputStatusCounts(row.status)) addUsage(approvalUsage, String(row.disputer_id || ''), row.output_count);
    }
  }

  const runs = await supabase
    .from('generation_runs')
    .select('owner_id,output_status,created_at')
    .in('owner_id', ids)
    .gte('created_at', start)
    .lt('created_at', end);

  if (!runs.error && Array.isArray(runs.data)) {
    for (const row of runs.data as RawOutputUsageRow[]) {
      if (outputStatusCounts(row.output_status)) addUsage(generationUsage, String(row.owner_id || ''), 1);
    }
  }

  const rows: EntitlementLimitRow[] = [];
  for (const id of ids) {
    const used = Math.max(approvalUsage.get(id) || 0, generationUsage.get(id) || 0);
    if (used > 0) rows.push({ ...emptyRow(id), output_used_today: used });
  }
  return rows;
}

export async function listEntitlementLimits(
  supabase: SupabaseServerClient,
  profileIds: string[]
): Promise<{ entitlements: EntitlementLimitMap; errorMessage: string | null }> {
  const ids = Array.from(new Set(profileIds.filter(Boolean)));
  if (!ids.length) return { entitlements: {}, errorMessage: null };

  const merged = new Map<string, EntitlementLimitRow>();
  const errorMessages: string[] = [];
  const daily = await readRpcRows(supabase, 'access_list_daily_entitlement_limits_v1', ids);
  for (const row of daily.rows) merged.set(row.profile_id, mergeRow(merged.get(row.profile_id), row));
  if (daily.errorMessage) errorMessages.push(daily.errorMessage);

  const shouldReadFallback = daily.missing || daily.rows.length < ids.length || daily.rows.some((row) => row.max_clients === null && row.default_client_output_limit === null && row.effective_output_limit === null);
  if (shouldReadFallback) {
    const fallback = await readRpcRows(supabase, 'access_list_entitlement_limits_v1', ids);
    for (const row of fallback.rows) merged.set(row.profile_id, mergeRow(merged.get(row.profile_id), row));
    if (fallback.errorMessage) errorMessages.push(fallback.errorMessage);
  }

  const tableRows = await readManagerLimitTableRows(supabase, ids);
  for (const row of tableRows) merged.set(row.profile_id, mergeRow(merged.get(row.profile_id), row));

  const activityRows = await readTodayOutputUsageRows(supabase, ids);
  for (const row of activityRows) merged.set(row.profile_id, mergeRow(merged.get(row.profile_id), row));

  for (const id of ids) if (!merged.has(id)) merged.set(id, emptyRow(id));

  return {
    entitlements: Object.fromEntries(Array.from(merged.values()).map((row) => [row.profile_id, row])),
    errorMessage: errorMessages[0] || null
  };
}
