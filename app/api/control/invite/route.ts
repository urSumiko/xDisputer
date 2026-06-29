import { NextResponse, type NextRequest } from 'next/server';
import { appRedirect } from '../../../../lib/supabase/origin';
import { rotateManagerInviteCode } from '../../../../lib/saas/account-management';
import { requireRole } from '../../../../lib/saas/session';

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const fallback = appRedirect(request, '/admin', { panel: 'intake' });
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;

  target.searchParams.set('control', status);
  if (message) target.searchParams.set('message', message.slice(0, 180));

  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireRole('manager');
    await rotateManagerInviteCode(supabase, user.id);

    return redirectBack(request, 'ok');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Invite control failed.');
  }
}
