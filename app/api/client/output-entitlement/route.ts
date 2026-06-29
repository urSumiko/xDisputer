import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type EntitlementRow = {
  allowed?: boolean;
  output_limit?: number | string | null;
  output_used_today?: number | string | null;
  output_remaining_today?: number | string | null;
  output_used_this_month?: number | string | null;
  output_remaining_this_month?: number | string | null;
  reset_at?: string | null;
  reset_seconds?: number | string | null;
  message?: string | null;
};

type ManagerLimitRow = {
  max_clients?: number | string | null;
  default_client_output_limit?: number | string | null;
  updated_at?: string | null;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function isMissingRpc(message: string | undefined) {
  return Boolean(message && (
    message.includes('Could not find the function') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  ));
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

function easternParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || now.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === 'month')?.value || now.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === 'day')?.value || now.getUTCDate())
  };
}

function zonedMidnightToUtc(year: number, month: number, day: number) {
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const probe = new Date(targetUtc);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(probe);
  const mappedUtc = Date.UTC(
    Number(parts.find((part) => part.type === 'year')?.value || year),
    Number(parts.find((part) => part.type === 'month')?.value || month) - 1,
    Number(parts.find((part) => part.type === 'day')?.value || day),
    Number(parts.find((part) => part.type === 'hour')?.value || 0),
    Number(parts.find((part) => part.type === 'minute')?.value || 0),
    Number(parts.find((part) => part.type === 'second')?.value || 0)
  );
  return new Date(targetUtc - (mappedUtc - targetUtc));
}

function nextUsEasternReset(now = new Date()) {
  const current = easternParts(now);
  const resetAt = zonedMidnightToUtc(current.year, current.month, current.day + 1);
  return {
    resetAt: resetAt.toISOString(),
    resetSeconds: Math.max(0, Math.floor((resetAt.getTime() - now.getTime()) / 1000))
  };
}

function normalizeManagerId(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function currentManagerId(supabase: SupabaseServerClient, userId: string) {
  const result = await supabase.rpc('access_current_client_manager_id_v1', { client_id_input: userId });
  if (!result.error) return normalizeManagerId(result.data);

  const { data } = await supabase
    .from('profiles')
    .select('manager_id')
    .eq('id', userId)
    .maybeSingle();
  return normalizeManagerId((data as { manager_id?: unknown } | null)?.manager_id);
}

async function readManagerLimit(supabase: SupabaseServerClient, managerId: string | null) {
  if (!managerId) return { maxClients: null as number | null, defaultOutputLimit: null as number | null, updatedAt: null as string | null };
  const { data } = await supabase
    .from('manager_entitlement_limits')
    .select('max_clients,default_client_output_limit,updated_at')
    .eq('manager_id', managerId)
    .maybeSingle();
  const row = data as ManagerLimitRow | null;
  return {
    maxClients: positiveOrNull(row?.max_clients),
    defaultOutputLimit: positiveOrNull(row?.default_client_output_limit),
    updatedAt: row?.updated_at || null
  };
}

function normalizeEntitlement(row: EntitlementRow | null, source: 'daily' | 'fallback' | 'none', managerId: string | null, managerLimit: { maxClients: number | null; defaultOutputLimit: number | null; updatedAt: string | null }) {
  const reset = nextUsEasternReset();
  const managerDefaultLimit = managerLimit.defaultOutputLimit;
  const outputLimit = managerDefaultLimit ?? positiveOrNull(row?.output_limit);
  const used = nonnegativeOrNull(row?.output_used_today ?? row?.output_used_this_month) ?? 0;
  const remainingFromRow = nonnegativeOrNull(row?.output_remaining_today ?? row?.output_remaining_this_month);
  const remaining = outputLimit === null ? null : remainingFromRow ?? Math.max(outputLimit - used, 0);
  const rowAllowed = typeof row?.allowed === 'boolean' ? row.allowed : outputLimit !== null && remaining !== 0;
  const allowed = outputLimit !== null && rowAllowed && remaining !== 0;

  return {
    outputLimit,
    managerDefaultOutputLimit: managerDefaultLimit,
    managerDisputerLimit: managerLimit.maxClients,
    managerLimitUpdatedAt: managerLimit.updatedAt,
    outputUsedToday: used,
    outputRemainingToday: remaining,
    resetAt: row?.reset_at || reset.resetAt,
    resetSeconds: nonnegativeOrNull(row?.reset_seconds) ?? reset.resetSeconds,
    allowed,
    message: allowed
      ? row?.message || null
      : row?.message || (outputLimit === null
        ? 'Master must set this manager daily output limit before this Disputer can generate output.'
        : 'Daily output limit reached. Your workspace unlocks when the limit is increased or at the next reset.'),
    managerId,
    source: managerDefaultLimit !== null ? 'master-manager-limit' : source,
    serverTime: new Date().toISOString()
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult.user) {
    return noStoreJson({ error: userError?.message || 'No authenticated user.' }, { status: 401 });
  }

  const managerId = await currentManagerId(supabase, userResult.user.id);
  const managerLimit = await readManagerLimit(supabase, managerId);
  const daily = await supabase.rpc('access_client_daily_output_entitlement_v1', {
    owner_id_input: userResult.user.id
  });

  if (!daily.error) {
    const row = Array.isArray(daily.data) ? daily.data[0] : null;
    return noStoreJson({ entitlement: normalizeEntitlement(row, 'daily', managerId, managerLimit) });
  }

  if (!isMissingRpc(daily.error.message)) {
    return noStoreJson({ error: daily.error.message }, { status: 500 });
  }

  const fallback = await supabase.rpc('access_check_generation_output_limit_v1', {
    owner_id_input: userResult.user.id
  });

  if (!fallback.error) {
    const row = Array.isArray(fallback.data) ? fallback.data[0] : null;
    return noStoreJson({ entitlement: normalizeEntitlement(row, 'fallback', managerId, managerLimit) });
  }

  if (!isMissingRpc(fallback.error.message)) {
    return noStoreJson({ error: fallback.error.message }, { status: 500 });
  }

  return noStoreJson({ entitlement: normalizeEntitlement(null, 'none', managerId, managerLimit) });
}
