import { NextResponse, type NextRequest } from 'next/server';
import { appRedirect } from '../../../../lib/supabase/origin';
import { requireRole } from '../../../../lib/saas/session';

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const fallback = appRedirect(request, '/master', { panel: 'access' });
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;

  target.searchParams.set('control', status);
  if (message) target.searchParams.set('message', message.slice(0, 180));

  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const targetManagerId = String(formData.get('managerId') || '').trim();

    if (!targetManagerId) {
      return redirectBack(request, 'error', 'Missing manager id.');
    }

    const { supabase } = await requireRole('master');

    const { error } = await supabase.rpc('access_master_rotate_manager_invite_code', {
      target_manager_id: targetManagerId
    });

    if (error) return redirectBack(request, 'error', error.message);

    return redirectBack(request, 'ok');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Invite rotation failed.');
  }
}
