import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { ensureUserProfile } from '../../../../lib/supabase/roles';
import { normalizeNotificationRole } from '../../../../lib/notifications/notification-types';
import { loadNotificationsForCurrentUser } from '../../../../src/features/notifications/notification-api-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonHeaders = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

type CountResult = { count: number; error: string | null };

type CountLike = PromiseLike<{ count: number | null; error: { message?: string } | null }>;

async function exactCount(query: CountLike): Promise<CountResult> {
  const result = await query;
  return result.error ? { count: 0, error: result.error.message || 'Count failed' } : { count: result.count || 0, error: null };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: jsonHeaders });

  const profile = await ensureUserProfile(supabase, user);
  const role = normalizeNotificationRole(profile?.role);

  const directNotificationCount = await exactCount(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_user_id', user.id));
  const directUnreadCount = await exactCount(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_user_id', user.id).is('read_at', null));
  const roleNotificationCount = await exactCount(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_role', role));
  const roleUnreadCount = await exactCount(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_role', role).is('read_at', null));

  const fallbackBase = supabase.from('manager_disputer_output_approvals').select('id', { count: 'exact', head: true }).eq('is_per_output', true);
  const outputActivityFallbackCount = role === 'manager'
    ? await exactCount(fallbackBase.eq('manager_id', user.id).eq('status', 'pending'))
    : role === 'client'
      ? await exactCount(fallbackBase.eq('disputer_id', user.id).in('status', ['approved', 'rejected']))
      : { count: 0, error: null };

  const bell = await loadNotificationsForCurrentUser(supabase, 8);
  const syncErrors = [directNotificationCount.error, directUnreadCount.error, roleNotificationCount.error, roleUnreadCount.error, outputActivityFallbackCount.error, bell.errorMessage, bell.syncErrorMessage || null].filter(Boolean);

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    role,
    profileRole: profile?.role || null,
    directNotificationCount: directNotificationCount.count,
    directUnreadCount: directUnreadCount.count,
    roleNotificationCount: roleNotificationCount.count,
    roleUnreadCount: roleUnreadCount.count,
    outputActivityFallbackCount: outputActivityFallbackCount.count,
    visibleBellCount: bell.notifications.length,
    visibleBellUnreadCount: bell.unreadCount,
    visibleBellIds: bell.notifications.map((item) => ({ id: item.id, href: item.href, read_at: item.read_at })),
    syncErrors,
    serverTime: new Date().toISOString()
  }, { headers: jsonHeaders });
}
