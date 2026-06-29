import type { createSupabaseServerClient } from '../supabase/server';
import type { NotificationAudienceRole, NotificationRecord } from './notification-types';
import { normalizeNotificationSeverity } from './notification-types';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RawNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  severity: string | null;
  read_at: string | null;
  created_at: string;
};

type OutputActivityNotificationRow = {
  id: string;
  manager_id: string | null;
  disputer_id: string | null;
  client_name: string | null;
  round_label: string | null;
  output_label: string | null;
  letter_route: string | null;
  output_count: number | null;
  status: string | null;
  is_per_output: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ListNotificationsInput = {
  supabase: SupabaseServerClient;
  userId: string;
  role: NotificationAudienceRole;
  limit?: number;
};

function toNotificationRecord(row: RawNotificationRow): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href || null,
    severity: normalizeNotificationSeverity(row.severity),
    read_at: row.read_at,
    created_at: row.created_at
  };
}

function safeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(40, Math.floor(value || 12)));
}

function uniqueIds(ids: unknown, limit = 40) {
  if (!Array.isArray(ids)) return [] as string[];
  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) as string[])).slice(0, limit);
}

function phDateTime(value: string | null | undefined) {
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

function roundText(row: OutputActivityNotificationRow) {
  return row.round_label || 'Selected round';
}

function clientText(row: OutputActivityNotificationRow) {
  return row.client_name || 'Client user';
}

function letterText(row: OutputActivityNotificationRow) {
  const raw = row.output_label || row.letter_route || 'Generated letter';
  return raw.replace(/^generated output task$/i, 'Generated letter').replace(/^generated letter$/i, 'Generated letter');
}

function managerBody(row: OutputActivityNotificationRow) {
  return `${clientText(row)} · ${roundText(row)} · ${letterText(row)} · ${phDateTime(row.created_at)} PH`;
}

function clientBody(row: OutputActivityNotificationRow) {
  const approved = row.status === 'approved';
  return `${roundText(row)} · ${letterText(row)} · ${approved ? 'confirmed' : 'returned'} · ${phDateTime(row.updated_at || row.created_at)} PH`;
}

function virtualManagerNotification(row: OutputActivityNotificationRow): NotificationRecord {
  return {
    id: `output-activity-manager-${row.id}`,
    title: 'Per-output generated letter',
    body: managerBody(row),
    href: `/admin/output-activity-v2?filter=per_output&activity=${row.id}`,
    severity: 'warning',
    read_at: null,
    created_at: row.created_at || row.updated_at || new Date().toISOString()
  };
}

function virtualClientNotification(row: OutputActivityNotificationRow): NotificationRecord {
  const approved = row.status === 'approved';
  return {
    id: `output-activity-client-${row.id}`,
    title: approved ? 'Per-output letter confirmed' : 'Per-output letter returned',
    body: clientBody(row),
    href: `/workspace?outputActivity=${row.id}`,
    severity: approved ? 'success' : 'warning',
    read_at: null,
    created_at: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function buildNotificationsQuery(input: {
  supabase: SupabaseServerClient;
  column: 'recipient_user_id' | 'recipient_role';
  value: string;
  limit: number;
}) {
  return input.supabase
    .from('notifications')
    .select('id,title,body,href,severity,read_at,created_at')
    .eq(input.column, input.value)
    .order('created_at', { ascending: false })
    .limit(input.limit);
}

async function queryNotifications(input: {
  supabase: SupabaseServerClient;
  column: 'recipient_user_id' | 'recipient_role';
  value: string;
  limit: number;
}) {
  const result = await buildNotificationsQuery(input);
  if (result.error) {
    return { data: [] as RawNotificationRow[], error: result.error };
  }

  return {
    data: (result.data || []) as RawNotificationRow[],
    error: null
  };
}

async function unreadCount(input: {
  supabase: SupabaseServerClient;
  column: 'recipient_user_id' | 'recipient_role';
  value: string;
}) {
  const result = await input.supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq(input.column, input.value)
    .is('read_at', null);

  return result.error ? { count: 0, error: result.error } : { count: result.count || 0, error: null };
}

async function outputActivityFallbackNotifications(input: {
  supabase: SupabaseServerClient;
  userId: string;
  role: NotificationAudienceRole;
  limit: number;
}) {
  const selectColumns = 'id,manager_id,disputer_id,client_name,round_label,output_label,letter_route,output_count,status,is_per_output,created_at,updated_at';

  if (input.role === 'manager') {
    const result = await input.supabase
      .from('manager_disputer_output_approvals')
      .select(selectColumns)
      .eq('manager_id', input.userId)
      .eq('is_per_output', true)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(input.limit);

    if (result.error) return [] as NotificationRecord[];
    return ((result.data || []) as OutputActivityNotificationRow[]).map(virtualManagerNotification);
  }

  if (input.role === 'client') {
    const result = await input.supabase
      .from('manager_disputer_output_approvals')
      .select(selectColumns)
      .eq('disputer_id', input.userId)
      .eq('is_per_output', true)
      .in('status', ['approved', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(input.limit);

    if (result.error) return [] as NotificationRecord[];
    return ((result.data || []) as OutputActivityNotificationRow[]).map(virtualClientNotification);
  }

  return [] as NotificationRecord[];
}

export async function listNotifications({ supabase, userId, role, limit }: ListNotificationsInput) {
  const cappedLimit = safeLimit(limit);

  const direct = await queryNotifications({
    supabase,
    column: 'recipient_user_id',
    value: userId,
    limit: cappedLimit
  });

  if (direct.error) {
    return {
      notifications: [] as NotificationRecord[],
      unreadCount: 0,
      errorMessage: direct.error.message
    };
  }

  const roleWide = await queryNotifications({
    supabase,
    column: 'recipient_role',
    value: role,
    limit: cappedLimit
  });

  if (roleWide.error) {
    return {
      notifications: [] as NotificationRecord[],
      unreadCount: 0,
      errorMessage: roleWide.error.message
    };
  }

  const dbNotifications = [
    ...(direct.data || []).map(toNotificationRecord),
    ...(roleWide.data || []).map(toNotificationRecord)
  ];
  const fallbackNotifications = await outputActivityFallbackNotifications({ supabase, userId, role, limit: cappedLimit });
  const merged = [...dbNotifications, ...fallbackNotifications];

  const unique = Array.from(new Map(merged.map((item) => [item.href || item.id, item])).values())
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, cappedLimit);

  const directUnread = await unreadCount({ supabase, column: 'recipient_user_id', value: userId });
  const roleUnread = await unreadCount({ supabase, column: 'recipient_role', value: role });
  const visibleUnread = unique.filter((item) => !item.read_at).length;
  const exactUnread = directUnread.error || roleUnread.error
    ? visibleUnread
    : Math.max(visibleUnread, directUnread.count + roleUnread.count);

  return { notifications: unique, unreadCount: exactUnread, errorMessage: null };
}

export async function markDirectNotificationsRead({
  supabase,
  userId,
  ids
}: {
  supabase: SupabaseServerClient;
  userId: string;
  ids?: unknown;
}) {
  const scopedIds = uniqueIds(ids);
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (scopedIds.length) query = query.in('id', scopedIds);

  const result = await query.select('id');

  if (result.error) return { updatedCount: 0, errorMessage: result.error.message };
  return { updatedCount: result.data ? result.data.length : 0, errorMessage: null };
}

export async function clearDirectReadNotifications({
  supabase,
  userId
}: {
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const result = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_user_id', userId)
    .not('read_at', 'is', null)
    .select('id');

  if (result.error) return { clearedCount: 0, errorMessage: result.error.message };
  return { clearedCount: result.data ? result.data.length : 0, errorMessage: null };
}
