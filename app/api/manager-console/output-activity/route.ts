import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '../../../../lib/saas/session';

function clean(value: FormDataEntryValue | null, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function intValue(value: FormDataEntryValue | null, fallback = 1) {
  return Math.max(1, Math.floor(numberValue(value, fallback)));
}

function redirectToConsole(request: NextRequest, state: 'ok' | 'error', message?: string) {
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : new URL('/admin?panel=payroll', request.url);
  target.searchParams.set('control', state);
  if (message) target.searchParams.set('message', message.slice(0, 160));
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const intent = clean(formData.get('intent'), 40);
    const { user, supabase } = await requireRole('manager');

    if (intent === 'create') {
      const disputerId = clean(formData.get('disputerId'), 80);
      if (!disputerId) return redirectToConsole(request, 'error', 'Missing disputer account.');
      const record = {
        manager_id: user.id,
        disputer_id: disputerId,
        output_label: clean(formData.get('outputLabel')) || 'Manual output task',
        output_count: intValue(formData.get('outputCount')),
        rate_amount: numberValue(formData.get('rateAmount')),
        status: 'pending',
        source: 'manual',
        payday_label: clean(formData.get('paydayLabel'), 80) || null,
        notes: clean(formData.get('notes'), 300) || null,
        updated_at: new Date().toISOString()
      };
      const saved = await supabase.from('manager_disputer_output_approvals').insert(record);
      if (saved.error) return redirectToConsole(request, 'error', saved.error.message);
      revalidatePath('/admin');
      return redirectToConsole(request, 'ok', 'Output activity added for manager confirmation.');
    }

    const activityId = clean(formData.get('activityId'), 80);
    if (!activityId) return redirectToConsole(request, 'error', 'Missing output activity.');

    const patch = intent === 'approve'
      ? { status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : intent === 'reject'
        ? { status: 'rejected', rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : intent === 'paid'
          ? { status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : null;

    if (!patch) return redirectToConsole(request, 'error', 'Invalid output activity action.');

    const updated = await supabase
      .from('manager_disputer_output_approvals')
      .update(patch)
      .eq('manager_id', user.id)
      .eq('id', activityId);

    if (updated.error) return redirectToConsole(request, 'error', updated.error.message);
    revalidatePath('/admin');
    return redirectToConsole(request, 'ok', 'Output activity updated.');
  } catch (error) {
    return redirectToConsole(request, 'error', error instanceof Error ? error.message : 'Output activity update failed.');
  }
}
