import { NextResponse, type NextRequest } from 'next/server';
import { appRedirect } from '../../../../lib/supabase/origin';
import { getSessionContext } from '../../../../lib/saas/session';
import { accountStatus, normalizeRole } from '../../../../lib/supabase/roles';

function redirectPending(request: NextRequest, status: 'ok' | 'error', message: string) {
  return NextResponse.redirect(
    appRedirect(request, '/account-pending', {
      control: status,
      message
    }),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();

  if (!session.user || !session.profile) {
    return NextResponse.redirect(appRedirect(request, '/login', { next: '/account-pending' }), 303);
  }

  const role = normalizeRole(session.profile.role);
  const status = accountStatus(session.profile);

  if (role !== 'client') {
    return redirectPending(request, 'error', 'Only client accounts can join a manager.');
  }

  if (session.profile.manager_id) {
    return redirectPending(request, 'error', 'This account is already connected to a manager.');
  }

  if (status !== 'pending_manager_assignment') {
    return redirectPending(request, 'error', 'This account cannot use a manager invite at its current status.');
  }

  const formData = await request.formData();
  const inviteCode = String(formData.get('inviteCode') || '').trim();

  if (!inviteCode) {
    return redirectPending(request, 'error', 'Manager invite code is required.');
  }

  const { data, error } = await session.supabase.rpc('access_attach_client_to_invite', {
    invite_code_input: inviteCode
  });

  if (error) {
    return redirectPending(request, 'error', error.message);
  }

  if (data !== 'PENDING_MANAGER_APPROVAL') {
    return redirectPending(request, 'error', 'Invalid or inactive manager invite code.');
  }

  return redirectPending(request, 'ok', 'Manager invite accepted. Your account is now waiting for manager approval.');
}
