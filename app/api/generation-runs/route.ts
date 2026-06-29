import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { workspaceAccessErrorResponse } from '../../../lib/saas/access-entitlement';
import { recordGenerationIntegrity } from '../../../lib/saas/integrity-ledger';
import { logSystemEvent, requestIdFrom, safeErrorMessage } from '../../../lib/saas/system-observability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
const allowedStatuses = ['generated', 'downloaded', 'failed'];

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type OutputActivitySyncRow = {
  activity_id?: string | null;
  notification_id?: string | null;
  sync_status?: string | null;
};

type DailyEntitlement = {
  allowed: boolean;
  outputLimit: number | null;
  outputUsedToday: number;
  outputRemainingToday: number | null;
  resetAt: string | null;
  resetSeconds: number | null;
  message: string | null;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return response;
}

function isMissingRpcError(message: string | undefined) {
  return Boolean(message && (message.includes('Could not find the function') || message.includes('does not exist') || message.includes('schema cache')));
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

function normalizeDailyEntitlement(row: any): DailyEntitlement | null {
  if (!row) return null;
  const outputLimit = positiveOrNull(row.output_limit);
  const outputUsedToday = nonnegativeOrNull(row.output_used_today ?? row.output_used_this_month) ?? 0;
  const outputRemainingToday = outputLimit === null ? null : nonnegativeOrNull(row.output_remaining_today ?? row.output_remaining_this_month) ?? Math.max(outputLimit - outputUsedToday, 0);
  const allowed = outputLimit !== null && row.allowed !== false && outputRemainingToday > 0;
  return {
    allowed,
    outputLimit,
    outputUsedToday,
    outputRemainingToday,
    resetAt: row.reset_at || null,
    resetSeconds: nonnegativeOrNull(row.reset_seconds),
    message: allowed ? row.message || null : row.message || (outputLimit === null ? 'Master must set this manager daily output limit before this Disputer can generate output.' : 'Daily output limit reached. This Disputer allowance resets at the next US Eastern day.')
  };
}

async function readDailyEntitlement(supabase: SupabaseServerClient, ownerId: string) {
  const strict = await supabase.rpc('access_assert_client_can_generate_v1', { owner_id_input: ownerId });
  if (!strict.error || !isMissingRpcError(strict.error.message)) return strict;
  const daily = await supabase.rpc('access_client_daily_output_entitlement_v1', { owner_id_input: ownerId });
  if (!daily.error || !isMissingRpcError(daily.error.message)) return daily;
  return supabase.rpc('access_check_generation_output_limit_v1', { owner_id_input: ownerId });
}

async function requireGenerationAllowance(input: { supabase: SupabaseServerClient; ownerId: string; requestId: string; startedAt: number }) {
  const limitCheck = await readDailyEntitlement(input.supabase, input.ownerId);
  if (limitCheck.error) {
    const message = isMissingRpcError(limitCheck.error.message)
      ? 'Output allowance SQL is not synced. Generation is blocked until the latest entitlement migration is applied.'
      : limitCheck.error.message;
    await logSystemEvent(input.supabase, { requestId: input.requestId, routePath: '/api/generation-runs', eventType: 'generation_output_limit_unavailable', eventStatus: 'error', durationMs: Date.now() - input.startedAt, safeMessage: message });
    return { ok: false as const, status: isMissingRpcError(limitCheck.error.message) ? 503 : 500, error: message, entitlement: null as DailyEntitlement | null };
  }

  const row = Array.isArray(limitCheck.data) ? limitCheck.data[0] : null;
  const entitlement = normalizeDailyEntitlement(row);
  if (!entitlement || entitlement.outputLimit === null) {
    const message = entitlement?.message || 'Master must set this manager daily output limit before this Disputer can generate output.';
    await logSystemEvent(input.supabase, { requestId: input.requestId, routePath: '/api/generation-runs', eventType: 'generation_output_limit_blocked', eventStatus: 'warning', durationMs: Date.now() - input.startedAt, safeMessage: message, metadata: entitlement || {} });
    return { ok: false as const, status: 403, error: message, entitlement };
  }

  if (!entitlement.allowed || entitlement.outputRemainingToday === null || entitlement.outputRemainingToday <= 0) {
    const message = entitlement.message || 'Daily output limit reached. This Disputer allowance resets at the next US Eastern day.';
    await logSystemEvent(input.supabase, { requestId: input.requestId, routePath: '/api/generation-runs', eventType: 'generation_output_limit_blocked', eventStatus: 'warning', durationMs: Date.now() - input.startedAt, safeMessage: message, metadata: entitlement });
    return { ok: false as const, status: 403, error: message, entitlement };
  }

  return { ok: true as const, entitlement };
}

function firstSyncRow(value: unknown): OutputActivitySyncRow | null {
  if (Array.isArray(value)) return (value[0] || null) as OutputActivitySyncRow | null;
  return (value || null) as OutputActivitySyncRow | null;
}

async function syncGeneratedOutputEverywhere(input: { generationRunId: string; disputerId: string }) {
  const admin = createSupabaseAdminClient();
  const profile = await admin
    .from('profiles')
    .select('manager_id')
    .eq('id', input.disputerId)
    .maybeSingle();

  if (profile.error) throw new Error(profile.error.message);
  const managerId = profile.data?.manager_id || null;

  const activitySync = await admin.rpc('sync_generation_output_activity_v1', {
    generation_run_id_input: input.generationRunId
  });
  if (activitySync.error) throw new Error(activitySync.error.message);

  const activityRow = firstSyncRow(activitySync.data);
  if (managerId) {
    const notificationRepair = await admin.rpc('sync_manager_output_activity_notifications_v1', {
      manager_id_input: managerId,
      max_rows: 50
    });
    if (notificationRepair.error) throw new Error(notificationRepair.error.message);
  }

  return {
    activityId: activityRow?.activity_id || null,
    notificationId: activityRow?.notification_id || null,
    notification: activityRow?.sync_status || (managerId ? 'synced' as const : 'no-manager' as const),
    managerId
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = requestIdFrom(request);
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;
  const supabase = await createSupabaseServerClient();
  try {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) return noStoreJson({ error: userError?.message || 'No authenticated user.' }, { status: 401 });
    const { data, error } = await supabase.from('generation_runs').select('id, client_name, round_label, output_status, created_at').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    await logSystemEvent(supabase, { requestId, routePath: '/api/generation-runs', eventType: 'generation_runs_list', eventStatus: 'success', durationMs: Date.now() - startedAt, metadata: { count: Array.isArray(data) ? data.length : 0 } });
    return noStoreJson({ runs: data || [] });
  } catch (error) {
    await logSystemEvent(supabase, { requestId, routePath: '/api/generation-runs', eventType: 'generation_runs_list', eventStatus: 'error', durationMs: Date.now() - startedAt, safeMessage: safeErrorMessage(error) });
    return noStoreJson({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = requestIdFrom(request);
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;
  const supabase = await createSupabaseServerClient();
  try {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) return noStoreJson({ error: userError?.message || 'No authenticated user.' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const clientName = String(body?.clientName || '').trim() || 'Unknown client';
    const round = String(body?.round || '').trim();
    const status = String(body?.status || 'generated').trim();
    const manifest = body?.manifest;
    const perOutputPay = body?.perOutputPay === true;
    if (!allowedRounds.includes(round)) return noStoreJson({ error: 'Invalid generation round.' }, { status: 400 });
    if (!allowedStatuses.includes(status)) return noStoreJson({ error: 'Invalid generation status.' }, { status: 400 });
    if (!manifest || typeof manifest !== 'object') return noStoreJson({ error: 'Generation manifest is required.' }, { status: 400 });

    const beforeAllowance = status === 'failed' ? null : await requireGenerationAllowance({ supabase, ownerId: userResult.user.id, requestId, startedAt });
    if (beforeAllowance && !beforeAllowance.ok) return noStoreJson({ error: beforeAllowance.error, entitlement: beforeAllowance.entitlement }, { status: beforeAllowance.status });

    const { data, error } = await supabase
      .from('generation_runs')
      .insert({ owner_id: userResult.user.id, client_name: clientName, round_label: round, manifest_json: manifest, output_status: status, per_output_pay: perOutputPay })
      .select('id, client_name, round_label, output_status, created_at')
      .single();
    if (error) throw error;

    const outputActivity = status === 'generated'
      ? await syncGeneratedOutputEverywhere({ generationRunId: data.id, disputerId: userResult.user.id }).catch((error) => ({ activityId: null, notificationId: null, notification: 'failed' as const, errorMessage: safeErrorMessage(error) }))
      : null;

    const integrityError = await recordGenerationIntegrity(supabase, { generationRunId: data.id, eventType: 'generation_run_recorded', manifest, rules: { allowedRounds, allowedStatuses, selectedRound: round, selectedStatus: status, perOutputPay }, status: status === 'failed' ? 'failed' : 'recorded', metadata: { clientName, round, status, perOutputPay, outputActivity } });
    await logSystemEvent(supabase, { requestId, routePath: '/api/generation-runs', eventType: 'generation_run_create', eventStatus: integrityError || (outputActivity && 'errorMessage' in outputActivity && outputActivity.errorMessage) ? 'warning' : 'success', durationMs: Date.now() - startedAt, safeMessage: integrityError || (outputActivity && 'errorMessage' in outputActivity ? outputActivity.errorMessage : null), metadata: { generationRunId: data.id, round, status, perOutputPay, outputActivity } });
    const afterLimit = status === 'failed' ? null : await readDailyEntitlement(supabase, userResult.user.id);
    const entitlement = afterLimit && !afterLimit.error && Array.isArray(afterLimit.data) ? normalizeDailyEntitlement(afterLimit.data[0]) : beforeAllowance?.entitlement || null;
    return noStoreJson({ run: data, entitlement, outputActivity });
  } catch (error) {
    await logSystemEvent(supabase, { requestId, routePath: '/api/generation-runs', eventType: 'generation_run_create', eventStatus: 'error', durationMs: Date.now() - startedAt, safeMessage: safeErrorMessage(error) });
    return noStoreJson({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
