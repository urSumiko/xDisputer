import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { updateManagedAccount } from '../../../../lib/saas/account-management';
import { requireRole } from '../../../../lib/saas/session';

function clean(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

function redirectBack(request: NextRequest, state: 'ok' | 'error', message?: string) {
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : new URL('/master/accounts?view=clients', request.url);
  target.searchParams.set('control', state);
  if (message) target.searchParams.set('message', message.slice(0, 180));
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const clientId = clean(formData, 'clientId');
    const managerId = clean(formData, 'managerId');

    if (!clientId) return redirectBack(request, 'error', 'Missing client account.');
    if (!managerId) return redirectBack(request, 'error', 'Choose a manager boss before saving.');

    const { user, supabase } = await requireRole('master');
    if (managerId === user.id) return redirectBack(request, 'error', 'Master account cannot be assigned as a client boss. Choose a manager account.');

    await updateManagedAccount(supabase, {
      actorUserId: user.id,
      actorRole: 'master',
      targetProfileId: clientId,
      nextManagerId: managerId,
      nextStatus: 'active'
    });

    revalidatePath('/master/accounts');
    revalidatePath('/admin');
    return redirectBack(request, 'ok', 'Client boss assignment saved.');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Boss assignment failed.');
  }
}
