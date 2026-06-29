import { createSupabaseAdminClient } from '../../../lib/supabase/admin';
import type { NotificationAudienceRole } from '../../../lib/notifications/notification-types';

type OutputActivityRow = {
  id: string;
  manager_id: string | null;
  disputer_id: string | null;
  client_name: string | null;
  round_label: string | null;
  output_count: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function phTime(value: string | null | undefined) {
  if (!value) return 'time not recorded';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(value));
  } catch {
    return 'time not recorded';
  }
}

function countText(value: number | null) {
  return Math.max(1, Number(value || 1));
}

async function hrefExists(recipientUserId: string, href: string) {
  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from('notifications')
    .select('id')
    .eq('recipient_user_id', recipientUserId)
    .eq('href', href)
    .limit(1)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  return Boolean(existing.data?.id);
}

async function insertNotification(input: {
  recipientUserId: string;
  recipientRole: NotificationAudienceRole;
  actorId: string | null;
  title: string;
  body: string;
  href: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}) {
  if (await hrefExists(input.recipientUserId, input.href)) return 0;

  const admin = createSupabaseAdminClient();
  const inserted = await admin.from('notifications').insert({
    recipient_user_id: input.recipientUserId,
    recipient_role: input.recipientRole,
    created_by: input.actorId,
    title: input.title,
    body: input.body,
    href: input.href,
    severity: input.severity
  });

  if (inserted.error) throw new Error(inserted.error.message);
  return 1;
}

async function repairManagerBell(userId: string) {
  const admin = createSupabaseAdminClient();
  const rows = await admin
    .from('manager_disputer_output_approvals')
    .select('id,manager_id,disputer_id,client_name,round_label,output_count,status,created_at,updated_at')
    .eq('manager_id', userId)
    .eq('is_per_output', true)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(40);

  if (rows.error) return rows.error.message;

  let created = 0;
  for (const row of (rows.data || []) as OutputActivityRow[]) {
    const href = `/admin/output-activity-v2?filter=per_output&activity=${row.id}`;
    created += await insertNotification({
      recipientUserId: userId,
      recipientRole: 'manager',
      actorId: row.disputer_id,
      title: 'Per-output generated letter',
      body: `${row.client_name || 'Client user'} · ${row.round_label || 'Selected round'} · ${countText(row.output_count)} item(s) · ${phTime(row.created_at)} PH`,
      href,
      severity: 'warning'
    });
  }

  return created > 0 ? null : null;
}

async function repairClientBell(userId: string) {
  const admin = createSupabaseAdminClient();
  const rows = await admin
    .from('manager_disputer_output_approvals')
    .select('id,manager_id,disputer_id,client_name,round_label,output_count,status,created_at,updated_at')
    .eq('disputer_id', userId)
    .eq('is_per_output', true)
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(40);

  if (rows.error) return rows.error.message;

  for (const row of (rows.data || []) as OutputActivityRow[]) {
    const approved = row.status === 'approved';
    const href = `/workspace?outputActivity=${row.id}`;
    await insertNotification({
      recipientUserId: userId,
      recipientRole: 'client',
      actorId: row.manager_id,
      title: approved ? 'Per-output letter confirmed' : 'Per-output letter returned',
      body: `${row.round_label || 'Selected round'} · ${countText(row.output_count)} item(s) · ${approved ? 'confirmed' : 'returned'} · ${phTime(row.updated_at || row.created_at)} PH`,
      href,
      severity: approved ? 'success' : 'warning'
    });
  }

  return null;
}

export async function repairBellNotificationsForUser(userId: string, role: NotificationAudienceRole) {
  try {
    if (role === 'manager') return await repairManagerBell(userId);
    if (role === 'client') return await repairClientBell(userId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Bell notification repair failed.';
  }
}
