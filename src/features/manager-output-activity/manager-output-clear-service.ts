import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import { requireRole } from '../../../lib/saas/session';

type ActivityRow = {
  id: string;
  generation_run_id: string | null;
  is_per_output: boolean | null;
  status: string | null;
};

function chunks<T>(items: T[], size = 75) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function notificationHrefs(activityIds: string[]) {
  return activityIds.flatMap((id) => [
    `/admin/output-activity-v2?filter=per_output&activity=${id}`,
    `/admin/output-activity-v2?filter=not_per_output&activity=${id}`,
    `/admin/output-activity-v2?filter=all&activity=${id}`,
    `/workspace?outputActivity=${id}`
  ]);
}

async function deleteInChunks<T extends string>(action: (items: T[]) => Promise<{ error?: { message: string } | null }>, items: T[]) {
  let deleted = 0;
  for (const part of chunks(items)) {
    const result = await action(part as T[]);
    if (result.error) throw new Error(result.error.message);
    deleted += part.length;
  }
  return deleted;
}

export async function clearManagerOutputHistory(request: NextRequest) {
  const { user } = await requireRole('manager');
  const formData = await request.formData().catch(() => null);
  const preservePending = String(formData?.get('preservePending') || 'true') !== 'false';
  const admin = createSupabaseAdminClient();

  let query = admin
    .from('manager_disputer_output_approvals')
    .select('id,generation_run_id,is_per_output,status')
    .eq('manager_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000);

  const result = await query;
  if (result.error) return { ok: false as const, message: result.error.message, clearedCount: 0, preservedCount: 0 };

  const rows = ((result.data || []) as ActivityRow[]);
  const preserved = preservePending
    ? rows.filter((row) => row.is_per_output === true && row.status === 'pending')
    : [];
  const clearable = preservePending
    ? rows.filter((row) => !(row.is_per_output === true && row.status === 'pending'))
    : rows;

  const activityIds = unique(clearable.map((row) => row.id));
  const generationRunIds = unique(clearable.map((row) => row.generation_run_id));
  const hrefs = unique(notificationHrefs(activityIds));

  if (!activityIds.length) {
    return { ok: true as const, message: preserved.length ? 'Nothing cleared. Pending per-output items were preserved.' : 'No output history to clear.', clearedCount: 0, preservedCount: preserved.length };
  }

  await deleteInChunks((items) => admin.from('notifications').delete().in('href', items), hrefs);
  await deleteInChunks((items) => admin.from('manager_disputer_output_approvals').delete().eq('manager_id', user.id).in('id', items), activityIds);

  if (generationRunIds.length) {
    await deleteInChunks((items) => admin.from('generation_runs').delete().in('id', items), generationRunIds);
  }

  return {
    ok: true as const,
    message: `Cleared ${activityIds.length} output history item(s). Preserved ${preserved.length} pending per-output item(s).`,
    clearedCount: activityIds.length,
    preservedCount: preserved.length
  };
}
