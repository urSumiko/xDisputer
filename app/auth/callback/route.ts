import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { appRedirect } from '../../../lib/supabase/origin';
import { normalizeNextPath } from '../../../lib/saas/routes';

function friendlyCallbackError(code: string | null, description: string | null) {
  if (code === 'otp_expired') {
    return 'Email confirmation link is invalid or expired. Request a fresh confirmation email or create the account again.';
  }

  return description || 'Authentication callback failed. Try signing in again.';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const next = normalizeNextPath(requestUrl.searchParams.get('next') || '/app');

  if (errorCode || errorDescription) {
    return NextResponse.redirect(
      appRedirect(request, '/login', {
        error: friendlyCallbackError(errorCode, errorDescription),
        next
      }),
      303
    );
  }

  if (!code) {
    return NextResponse.redirect(
      appRedirect(request, '/login', {
        error: 'Missing confirmation code. Request a fresh confirmation email.',
        next
      }),
      303
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      appRedirect(request, '/login', {
        error: friendlyCallbackError(error.name, error.message),
        next
      }),
      303
    );
  }

  return NextResponse.redirect(appRedirect(request, next), 303);
}
