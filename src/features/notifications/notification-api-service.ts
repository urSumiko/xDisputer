import type { createSupabaseServerClient } from '../../../lib/supabase/server';
import { ensureUserProfile } from '../../../lib/supabase/roles';
import { clearDirectReadNotifications, listNotifications, markDirectNotificationsRead } from '../../../lib/notifications/notification-service';
import { normalizeNotificationRole } from '../../../lib/notifications/notification-types';
import { repairBellNotificationsForUser } from './bell-notification-repair-service';

export type NotificationApiPayload = {
  notifications: Awaited<ReturnType<typeof listNotifications>>['notifications'];
  unreadCount: number;
  errorMessage: string | null;
  syncErrorMessage?: string | null;
  status: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function syncRecentManagerGeneratedOutput(supabase: SupabaseServerClient, managerId: string, role: string) {
  if (role !== 'manager') return null;

  try {
    const activitySync = await supabase.rpc('sync_manager_recent_generation_output_activity_v1', {
      manager_id_input: managerId,
      max_rows: 50
    });
    if (activitySync.error) return activitySync.error.message;

    const notificationSync = await supabase.rpc('sync_manager_output_activity_notifications_v1', {
      manager_id_input: managerId,
      max_rows: 50
    });
    if (notificationSync.error) return notificationSync.error.message;
  } catch (error) {
    return error instanceof Error ? error.message : 'Manager notification sync failed.';
  }

  return null;
}

function joinMessages(left: string | null, right: string | null) {
  return [left, right].filter(Boolean).join(' | ') || null;
}

export async function loadNotificationsForCurrentUser(supabase: SupabaseServerClient, limit = 8): Promise<NotificationApiPayload> {
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { notifications: [], unreadCount: 0, errorMessage: null, status: 401 };

  const profile = await ensureUserProfile(supabase, user);
  const role = normalizeNotificationRole(profile?.role);
  const syncErrorMessage = await syncRecentManagerGeneratedOutput(supabase, user.id, role);
  const bellErrorMessage = await repairBellNotificationsForUser(user.id, role);
  const result = await listNotifications({ supabase, userId: user.id, role, limit });

  return {
    notifications: result.notifications,
    unreadCount: result.unreadCount,
    errorMessage: result.errorMessage,
    syncErrorMessage: joinMessages(syncErrorMessage, bellErrorMessage),
    status: 200
  };
}

export async function markNotificationsReadForCurrentUser(supabase: SupabaseServerClient, ids?: unknown) {
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { updatedCount: 0, errorMessage: null, status: 401 };

  const result = await markDirectNotificationsRead({ supabase, userId: user.id, ids });
  return { updatedCount: result.updatedCount, errorMessage: result.errorMessage, status: 200 };
}

export async function clearReadNotificationsForCurrentUser(supabase: SupabaseServerClient) {
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { clearedCount: 0, errorMessage: null, status: 401 };

  const result = await clearDirectReadNotifications({ supabase, userId: user.id });
  return { clearedCount: result.clearedCount, errorMessage: result.errorMessage, status: 200 };
}
