import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CreateNotificationInput = {
  supabase: SupabaseServerClient;
  createdBy: string;
  recipientUserId?: string | null;
  recipientRole?: NotificationAudienceRole | null;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: NotificationSeverity;
};

function isMissingNotificationTable(message: string | undefined) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('schema cache')
    || lower.includes('does not exist')
    || lower.includes('relation "public.notifications" does not exist')
    || lower.includes('could not find the table')
    || lower.includes('could not find the function');
}

function buildNotificationRecord(input: CreateNotificationInput) {
  return {
    recipient_user_id: input.recipientUserId || null,
    recipient_role: input.recipientRole || null,
    title: input.title.trim().slice(0, 140),
    body: input.body ? input.body.trim().slice(0, 500) : null,
    href: input.href || null,
    severity: input.severity || 'info',
    created_by: input.createdBy
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const title = input.title.trim().slice(0, 140);
  if (!title) return { ok: false, errorMessage: 'Notification title is required.' };
  if (!input.recipientUserId && !input.recipientRole) {
    return { ok: false, errorMessage: 'Notification recipient is required.' };
  }

  const record = buildNotificationRecord({ ...input, title });
  const result = await input.supabase.from('notifications').insert(record).select('id').single();
  if (!result.error) return { ok: true, notificationId: result.data?.id || null, errorMessage: null };
  if (isMissingNotificationTable(result.error.message)) {
    return { ok: false, notificationId: null, errorMessage: 'Notifications table or schema cache is missing.' };
  }

  return {
    ok: false,
    notificationId: null,
    errorMessage: result.error.message
  };
}
