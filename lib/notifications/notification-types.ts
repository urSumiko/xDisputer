import type { UserRole } from '../supabase/roles';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationRecord = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  severity: NotificationSeverity;
  read_at: string | null;
  created_at: string;
};

export type NotificationAudienceRole = Extract<UserRole, 'client' | 'manager' | 'master'>;

export type NotificationApiResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
};

export type NotificationReadRequest = {
  ids?: string[];
};

export function normalizeNotificationSeverity(value: unknown): NotificationSeverity {
  return value === 'success' || value === 'warning' || value === 'error' ? value : 'info';
}

export function normalizeNotificationRole(value: UserRole | null | undefined): NotificationAudienceRole {
  if (value === 'master') return 'master';
  if (value === 'manager' || value === 'admin') return 'manager';
  return 'client';
}
