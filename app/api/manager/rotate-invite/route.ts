import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { rotateManagerInviteCode } from '../../../../lib/saas/account-management';
import { requireRole } from '../../../../lib/saas/session';

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : new URL('/admin?panel=requests', request.url);
  target.searchParams.set('control', status);
  if (message) target.searchParams.set('message', message.slice(0, 200));
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireRole('manager');
    await rotateManagerInviteCode(supabase, user.id);
    revalidatePath('/admin');
    return redirectBack(request, 'ok', 'Manager invite code rotated. Share only the newest code or link.');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Invite rotation failed.');
  }
}
