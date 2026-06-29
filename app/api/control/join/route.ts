import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const fallback = new URL('/workspace', request.url);
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;

  target.searchParams.set('control', status);
  if (message) target.searchParams.set('message', message.slice(0, 180));

  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const inviteCode = String(formData.get('inviteCode') || '').trim().toUpperCase();

    if (!inviteCode) return redirectBack(request, 'error', 'Manager invite code is required.');

    const supabase = await createSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    if (!userResult.user) {
      const login = new URL('/login', request.url);
      login.searchParams.set('next', '/workspace');
      return NextResponse.redirect(login, 303);
    }

    const { error } = await supabase.rpc('control_join_manager', { invite_code: inviteCode });

    if (error) return redirectBack(request, 'error', error.message);

    return redirectBack(request, 'ok');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Manager join request failed.');
  }
}
