import type { NextRequest } from 'next/server';
import { requireRole } from '../../../lib/saas/session';
import { outputActivityContract } from './output-activity-contract';

function text(value: FormDataEntryValue | null, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function amount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : outputActivityContract.defaultRateAmount;
}

export function decisionStatus(action: string) {
  if (action === 'confirm') return outputActivityContract.status.approved;
  if (action === 'reject') return outputActivityContract.status.rejected;
  return '';
}

export async function applyManagerOutputDecision(request: NextRequest) {
  const formData = await request.formData();
  const id = text(formData.get('activityId'), 80);
  const action = text(formData.get('action'), 40);
  const rate = amount(formData.get('rateAmount'));
  if (!id) return { ok: false as const, message: 'Missing output activity.' };

  const { user, supabase } = await requireRole('manager');
  const existing = await supabase
    .from('manager_disputer_output_approvals')
    .select('id, disputer_id, output_label, rate_amount, status, is_per_output')
    .eq('manager_id', user.id)
    .eq('id', id)
    .maybeSingle();

  if (existing.error) return { ok: false as const, message: existing.error.message };
  if (!existing.data) return { ok: false as const, message: 'Output activity not found.' };

  const status = decisionStatus(action);
  if (!status) return { ok: false as const, message: 'Invalid manager decision.' };
  if (existing.data.is_per_output !== true) return { ok: false as const, message: 'This generated output is not per-output, so no manager confirmation is required.' };
  if ((action === 'confirm' || action === 'reject') && existing.data.status !== outputActivityContract.status.pending) return { ok: false as const, message: 'Only pending per-output items can be confirmed or returned.' };

  const patch = status === outputActivityContract.status.approved
    ? { status, rate_amount: rate, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { status, rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const updated = await supabase.from('manager_disputer_output_approvals').update(patch).eq('manager_id', user.id).eq('id', id);
  if (updated.error) return { ok: false as const, message: updated.error.message };

  const notificationSync = await supabase.rpc('sync_output_activity_decision_notification_v1', {
    activity_id_input: id
  });

  if (notificationSync.error) {
    return {
      ok: true as const,
      message: `${status === outputActivityContract.status.approved ? 'Output confirmed' : 'Output returned'}, but client notification sync needs repair: ${notificationSync.error.message}`
    };
  }

  return { ok: true as const, message: status === outputActivityContract.status.approved ? 'Output confirmed.' : 'Output returned.' };
}
