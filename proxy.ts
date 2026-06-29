import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isProtectedPath, routeForSignedInUser } from './lib/saas/routes';
import type { UserRole } from './lib/supabase/roles';

const bootstrapMasterEmails = new Set(['mycoquibuyen2002@gmail.com']);

function roleFromEmail(email: string | null | undefined): UserRole | null {
  return email && bootstrapMasterEmails.has(email.toLowerCase()) ? 'master' : null;
}

function redirectTo(request: NextRequest, pathname: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (!url || !anonKey) {
    if (isProtectedPath(pathname)) return redirectTo(request, '/login');
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers
          }
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,email')
    .eq('id', user.id)
    .maybeSingle();

  const resolvedRole = roleFromEmail(user.email) || roleFromEmail(profile?.email) || profile?.role;
  const destination = routeForSignedInUser(resolvedRole, pathname);

  if (destination !== pathname) {
    return redirectTo(request, destination);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/master/:path*', '/admin/:path*', '/workspace/:path*', '/client/:path*', '/system/:path*']
};
