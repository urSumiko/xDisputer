import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { normalizeAccountDisplayName, saveCurrentAccountProfile } from '../../../../lib/saas/account-profile-settings';
import { revalidateAccountProfileRoutes } from '../../../../src/features/account-profile/account-profile-revalidation';

function safeRedirectTarget(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function appendAccountSettingsState(next: string, state: 'saved' | 'error', reason?: string | null, displayName?: string | null) {
  const [path = '/', query = ''] = next.split('?');
  const params = new URLSearchParams(query);
  params.set('account_settings', state);
  if (reason) params.set('account_settings_reason', reason.slice(0, 80));
  if (displayName) params.set('account_settings_name', displayName.slice(0, 120));
  params.set('account_settings_sync', String(Date.now()));
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function relativeRedirect(location: string) {
  const response = new NextResponse(null, { status: 303, headers: { Location: location } });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function redirectBack(next: string, state: 'saved' | 'error', reason?: string | null, displayName?: string | null) {
  return relativeRedirect(appendAccountSettingsState(next, state, reason, displayName));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const next = safeRedirectTarget(formData.get('next'));
  const fullName = normalizeAccountDisplayName(formData.get('full_name'));
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) return relativeRedirect('/login');

  const result = await saveCurrentAccountProfile({ supabase, user, displayName: fullName });
  revalidateAccountProfileRoutes(next);

  if (!result.ok) return redirectBack(next, 'error', result.strategy, result.displayName);
  return redirectBack(next, 'saved', result.strategy, result.displayName);
}
