import { normalizeRole, type UserRole } from '../supabase/roles';

export const publicRoutes = ['/', '/login', '/signup'] as const;
export const protectedRoutes = ['/app', '/master', '/admin', '/manager-workspace', '/workspace', '/client', '/client/workspace'] as const;

export function isSafeInternalPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function normalizeNextPath(value: string | null | undefined) {
  return isSafeInternalPath(value) ? value! : '/app';
}

export function dashboardForRole(role: UserRole | null | undefined) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'master') return '/master';
  if (normalizedRole === 'manager') return '/admin';
  return '/workspace';
}

export function routeForSignedInUser(role: UserRole | null | undefined, requestedPath?: string | null) {
  const normalizedRole = normalizeRole(role);
  const next = normalizeNextPath(requestedPath);
  const dashboard = dashboardForRole(normalizedRole);

  if (next === '/app' || next === '/dashboard' || next === '/client' || next === '/client/workspace') {
    return dashboard;
  }

  if (normalizedRole === 'master') return next === '/admin' || next.startsWith('/admin/') ? '/master' : next;

  if (normalizedRole === 'manager' && (next === '/master' || next.startsWith('/master/') || next === '/workspace' || next.startsWith('/workspace/'))) {
    return '/admin';
  }

  if (normalizedRole === 'client' && (next === '/master' || next.startsWith('/master/') || next === '/admin' || next.startsWith('/admin/') || next === '/manager-workspace' || next.startsWith('/manager-workspace/'))) {
    return '/workspace';
  }

  return next;
}

export function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
