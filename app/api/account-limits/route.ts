import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { ensureUserProfile, normalizeRole } from '../../../lib/supabase/roles';

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const fallback = new URL('/master/accounts', request.url);
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;
  target.searchParams.set('limits', status);
  if (message) target.searchParams.set('message', message.slice(0, 180));
  return NextResponse.redirect(target, 303);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

function optionalWholeNumber(raw: string) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error('Limit must be a whole number of 0 or greater.');
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const profileId = text(formData, 'profileId');
    const managerClientLimit = optionalWholeNumber(text(formData, 'managerClientLimit'));
    const clientOutputLimit = optionalWholeNumber(text(formData, 'clientOutputLimit'));

    if (!profileId) return redirectBack(request, 'error', 'Missing profile id.');
    if (managerClientLimit === null && clientOutputLimit === null) return redirectBack(request, 'error', 'Enter a limit before saving.');

    const supabase = await createSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    if (!userResult.user) {
      const login = new URL('/login', request.url);
      login.searchParams.set('next', '/master/accounts');
      return NextResponse.redirect(login, 303);
    }

    const actorProfile = await ensureUserProfile(supabase, userResult.user);
    if (normalizeRole(actorProfile?.role) !== 'master') return redirectBack(request, 'error', 'Only master can change account limits.');

    const { error } = await supabase.rpc('access_master_set_account_limits_v1', {
      target_profile_id: profileId,
      manager_client_limit_input: managerClientLimit,
      client_output_limit_input: clientOutputLimit
    });

    if (error) return redirectBack(request, 'error', error.message);
    return redirectBack(request, 'ok');
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Could not save account limit.');
  }
}
