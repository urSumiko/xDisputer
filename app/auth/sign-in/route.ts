import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { appRedirect } from '../../../lib/supabase/origin';
import { accountStatus, ensureUserProfile, normalizeRole, roleForEmail } from '../../../lib/supabase/roles';
import { normalizeNextPath, routeForSignedInUser } from '../../../lib/saas/routes';

function friendlySignInError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Invalid email or password.';
  if (/email not confirmed/i.test(message)) return 'Email is not confirmed yet. Check your inbox or disable email confirmation for local testing.';
  return message;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = normalizeNextPath(String(formData.get('next') || '/app'));

  if (!email || !password) {
    return NextResponse.redirect(appRedirect(request, '/login', { error: 'Email and password are required.', next }), 303);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return NextResponse.redirect(appRedirect(request, '/login', { error: friendlySignInError(error.message), next }), 303);
  }

  const { data: userResult } = await supabase.auth.getUser();
  const profile = userResult.user ? await ensureUserProfile(supabase, userResult.user) : null;
  const emailRole = roleForEmail(userResult.user?.email || profile?.email);
  const resolvedRole = emailRole !== 'client' ? emailRole : profile?.role || 'client';

  if (normalizeRole(resolvedRole) === 'client' && accountStatus(profile) !== 'active') {
    return NextResponse.redirect(appRedirect(request, '/account-pending'), 303);
  }

  return NextResponse.redirect(appRedirect(request, routeForSignedInUser(resolvedRole, next)), 303);
}
