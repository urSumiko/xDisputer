import type { ClientTemplateDbClient, ClientTemplateOutputLimit } from './client-template-types';

function nextResetUtc() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function normalizeLimit(row: Record<string, unknown>): ClientTemplateOutputLimit {
  const dailyLimit = Number(row.daily_limit ?? 10);
  const usedToday = Number(row.used_today ?? 0);
  const nextResetAt = String(row.next_reset_at || nextResetUtc());
  return {
    dailyLimit,
    usedToday,
    remainingToday: Math.max(0, dailyLimit - usedToday),
    nextResetAt,
    canGenerate: usedToday < dailyLimit,
    policy: row.limit_policy && typeof row.limit_policy === 'object' ? row.limit_policy as Record<string, unknown> : {}
  };
}

export async function resolveClientOutputLimit(input: { supabase: ClientTemplateDbClient; managerUserId: string | null; clientUserId: string }): Promise<ClientTemplateOutputLimit> {
  if (!input.managerUserId) {
    return { dailyLimit: 0, usedToday: 0, remainingToday: 0, nextResetAt: nextResetUtc(), canGenerate: false, policy: { reason: 'No manager assignment.' } };
  }

  const { data, error } = await input.supabase
    .from('client_output_limits')
    .select('*')
    .eq('manager_user_id', input.managerUserId)
    .eq('client_user_id', input.clientUserId)
    .maybeSingle();

  if (!error && data) {
    const limit = normalizeLimit(data as Record<string, unknown>);
    if (new Date(limit.nextResetAt).getTime() <= Date.now()) {
      const reset = await input.supabase
        .from('client_output_limits')
        .upsert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, daily_limit: limit.dailyLimit, used_today: 0, next_reset_at: nextResetUtc(), limit_policy: limit.policy, updated_at: new Date().toISOString() }, { onConflict: 'manager_user_id,client_user_id' })
        .select('*')
        .single();
      if (!reset.error && reset.data) return normalizeLimit(reset.data as Record<string, unknown>);
    }
    return limit;
  }

  const created = await input.supabase
    .from('client_output_limits')
    .upsert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, daily_limit: 10, used_today: 0, next_reset_at: nextResetUtc(), limit_policy: { source: 'client-runtime-default' } }, { onConflict: 'manager_user_id,client_user_id' })
    .select('*')
    .single();

  if (created.error || !created.data) return { dailyLimit: 10, usedToday: 0, remainingToday: 10, nextResetAt: nextResetUtc(), canGenerate: true, policy: { source: 'fallback' } };
  return normalizeLimit(created.data as Record<string, unknown>);
}

export async function incrementClientOutputUsage(input: { supabase: ClientTemplateDbClient; managerUserId: string; clientUserId: string; generatedCount: number }) {
  const current = await resolveClientOutputLimit(input);
  const nextUsed = current.usedToday + Math.max(1, input.generatedCount);
  await input.supabase
    .from('client_output_limits')
    .upsert({ manager_user_id: input.managerUserId, client_user_id: input.clientUserId, daily_limit: current.dailyLimit, used_today: nextUsed, next_reset_at: current.nextResetAt, limit_policy: current.policy, updated_at: new Date().toISOString() }, { onConflict: 'manager_user_id,client_user_id' });
  return { ...current, usedToday: nextUsed, remainingToday: Math.max(0, current.dailyLimit - nextUsed), canGenerate: nextUsed < current.dailyLimit };
}
