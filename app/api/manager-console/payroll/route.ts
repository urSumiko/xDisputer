import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '../../../../lib/saas/session';
import { buildManagerPayrollSettingsRecord, readPayrollForm } from '../../../../src/features/manager-console/payroll-settings-service';

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
    const input = readPayrollForm(formData);
    if (!input.profileId) return redirectToConsole(request, 'error', 'Missing account.');

    const { user, supabase } = await requireRole('manager');
    const record = buildManagerPayrollSettingsRecord(input, user.id);
    const saved = await supabase.from('manager_user_settings').upsert(record, { onConflict: 'manager_id,user_id' });
    if (saved.error) return redirectToConsole(request, 'error', saved.error.message);

    revalidatePath('/admin');
    return redirectToConsole(request, 'ok', 'Disputer payroll settings saved.');
  } catch (error) {
    return redirectToConsole(request, 'error', error instanceof Error ? error.message : 'Payroll settings failed.');
  }
}
