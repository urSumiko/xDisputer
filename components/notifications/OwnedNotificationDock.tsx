'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationRecord } from '../../lib/notifications/notification-types';
import { useOwnedNotifications } from '../../src/features/notifications/useOwnedNotifications';

const OWNED_NOTIFICATION_DOCK_CSS = `
  .notification-dock[data-notification-dock="true"] { position: relative; z-index: 3; }
  .notification-dock-button { position: relative; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid rgba(191, 219, 254, .9); border-radius: 15px; background: rgba(239, 246, 255, .96); color: #1d4ed8; font-weight: 950; cursor: pointer; box-shadow: 0 10px 24px rgba(29, 78, 216, .12); }
  .notification-dock-button.has-unread { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
  .notification-dock-badge { position: absolute; top: -7px; right: -7px; min-width: 19px; height: 19px; display: grid; place-items: center; border-radius: 999px; background: #dc2626; color: #fff; font-size: 10px; padding-inline: 5px; }
  .notification-dock-popover { position: absolute; top: 52px; right: 0; width: min(390px, calc(100vw - 32px)); display: grid; gap: 10px; padding: 14px; border: 1px solid rgba(203, 213, 225, .92); border-radius: 22px; background: rgba(255, 255, 255, .98); box-shadow: 0 24px 62px rgba(15, 23, 42, .18); }
  .notification-dock-header { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
  .notification-dock-header-copy { display: grid; gap: 2px; min-width: 0; }
  .notification-dock-header-copy small { color: #64748b; font-weight: 750; }
  .notification-dock-close { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(203, 213, 225, .92); border-radius: 999px; background: #fff; color: #334155; font-size: 18px; font-weight: 950; line-height: 1; cursor: pointer; }
  .notification-dock-actions { display: flex; justify-content: flex-start; align-items: center; gap: 7px; flex-wrap: wrap; }
  .notification-dock-action { border: 1px solid rgba(203, 213, 225, .92); border-radius: 999px; background: #fff; color: #334155; font-size: 12px; font-weight: 850; padding: 6px 10px; cursor: pointer; }
  .notification-dock-action.danger { color: #b91c1c; border-color: rgba(248, 113, 113, .5); background: #fff1f2; }
  .notification-dock-list { display: grid; gap: 8px; max-height: 410px; overflow: auto; padding-right: 2px; }
  .notification-dock-group { display: grid; gap: 6px; }
  .notification-dock-group-title { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 10px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .notification-dock-group-title:after { content: ''; height: 1px; flex: 1; background: rgba(203, 213, 225, .9); }
  .notification-dock-row { width: 100%; display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 11px; border: 1px solid rgba(226, 232, 240, .96); border-radius: 16px; background: #f8fafc; color: #0f172a; text-align: left; cursor: pointer; }
  .notification-dock-row.unread { border-color: rgba(96, 165, 250, .85); background: #eff6ff; }
  .notification-dock-row.read { opacity: .74; }
  .notification-dock-dot { width: 9px; height: 9px; border-radius: 999px; background: #cbd5e1; }
  .notification-dock-row.unread .notification-dock-dot { background: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, .12); }
  .notification-dock-row.warning.unread .notification-dock-dot { background: #d97706; box-shadow: 0 0 0 4px rgba(217, 119, 6, .13); }
  .notification-dock-row.success.unread .notification-dock-dot { background: #16a34a; box-shadow: 0 0 0 4px rgba(22, 163, 74, .13); }
  .notification-dock-row.error.unread .notification-dock-dot { background: #dc2626; box-shadow: 0 0 0 4px rgba(220, 38, 38, .13); }
  .notification-dock-row-main { display: grid; gap: 3px; min-width: 0; }
  .notification-dock-row-title { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 950; }
  .notification-dock-row-meta { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b; font-size: 11px; font-weight: 760; }
  .notification-dock-row-state { display: inline-flex; align-items: center; justify-content: center; min-width: 46px; padding: 4px 8px; border-radius: 999px; background: #e2e8f0; color: #475569; font-size: 10px; font-weight: 950; text-transform: uppercase; }
  .notification-dock-row.unread .notification-dock-row-state { background: #dbeafe; color: #1d4ed8; }
  .notification-dock-empty { color: #64748b; margin: 0; }
  .notification-dock-sync-warning { margin: 0; padding: 9px 10px; border: 1px solid rgba(251, 191, 36, .7); border-radius: 14px; background: #fffbeb; color: #92400e; font-size: 12px; font-weight: 750; }
  .notification-dock-detail-backdrop { position: absolute; inset: 0; border-radius: 22px; background: rgba(248, 250, 252, .86); backdrop-filter: blur(4px); display: grid; align-items: start; padding: 10px; }
  .notification-dock-detail { display: grid; gap: 10px; padding: 13px; border: 1px solid rgba(191, 219, 254, .95); border-radius: 19px; background: #fff; box-shadow: 0 18px 42px rgba(15, 23, 42, .16); }
  .notification-dock-detail-head { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
  .notification-dock-detail-title { display: grid; gap: 3px; min-width: 0; }
  .notification-dock-detail-title strong { font-size: 15px; line-height: 1.2; }
  .notification-dock-detail-title small { color: #64748b; font-weight: 800; }
  .notification-dock-detail-close { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid rgba(203, 213, 225, .9); border-radius: 999px; background: #fff; color: #334155; font-size: 18px; font-weight: 950; cursor: pointer; }
  .notification-dock-detail-context { display: grid; gap: 6px; padding: 9px; border-radius: 14px; background: #f8fafc; border: 1px solid rgba(226,232,240,.92); }
  .notification-dock-context-line { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 8px; align-items: baseline; font-size: 12px; }
  .notification-dock-context-line b { color: #334155; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
  .notification-dock-context-line span { min-width: 0; color: #0f172a; font-weight: 800; overflow-wrap: anywhere; }
  .notification-dock-detail-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .notification-dock-time { color: #64748b; font-weight: 760; font-size: 11px; }
  .notification-dock-open-button { min-height: 36px; padding: 8px 14px; border: 0; border-radius: 999px; background: #2563eb; color: #fff; font-size: 12px; font-weight: 950; cursor: pointer; white-space: nowrap; }
`;

type DisplayNotification = NotificationRecord & {
  group: string;
  context: Array<{ label: string; value: string }>;
  actionLabel: string;
  summary: string;
};

function notificationActionLabel(item: NotificationRecord) {
  const href = item.href || '';
  if (href.includes('/admin/output-activity-v2')) return 'Review';
  if (href.includes('/workspace')) return 'Open';
  return 'View';
}

function groupLabel(item: NotificationRecord) {
  const href = item.href || '';
  if (href.includes('/admin/output-activity-v2')) return 'Manager Output Activity';
  if (href.includes('/workspace')) return 'Client Workspace';
  return 'General';
}

function cleanPart(part: string) {
  return part.trim().replace(/\s+/g, ' ');
}

function bodyParts(body: string | null) {
  return String(body || '').split('·').map(cleanPart).filter(Boolean).filter((part) => !/^\d+\s+item\(s\)$/i.test(part));
}

function contextLines(item: NotificationRecord) {
  const parts = bodyParts(item.body);
  const href = item.href || '';
  if (href.includes('/admin/output-activity-v2')) {
    return [
      { label: 'Client', value: parts[0] || 'Client user' },
      { label: 'Round', value: parts[1] || 'Selected round' },
      { label: 'Letter', value: parts[2] || 'Generated letter' }
    ];
  }
  if (href.includes('/workspace')) {
    return [
      { label: 'Round', value: parts[0] || 'Selected round' },
      { label: 'Letter', value: parts[1] || 'Generated letter' },
      { label: 'Status', value: parts[2] || item.title }
    ];
  }
  return parts.slice(0, 3).map((value, index) => ({ label: index === 0 ? 'Info' : 'Detail', value }));
}

function summary(item: NotificationRecord) {
  const lines = contextLines(item);
  const preferred = lines.find((line) => line.label === 'Client') || lines.find((line) => line.label === 'Letter') || lines[0];
  return preferred?.value || item.body || 'Open notification';
}

function displayNotifications(items: NotificationRecord[]): DisplayNotification[] {
  return items.map((item) => ({
    ...item,
    group: groupLabel(item),
    context: contextLines(item),
    actionLabel: notificationActionLabel(item),
    summary: summary(item)
  }));
}

function grouped(items: DisplayNotification[]) {
  const map = new Map<string, DisplayNotification[]>();
  for (const item of items) map.set(item.group, [...(map.get(item.group) || []), item]);
  return Array.from(map.entries());
}

function relativeTime(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function phDateTime(value: string) {
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
    return '';
  }
}

export default function OwnedNotificationDock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    notifications,
    unreadCount,
    errorMessage,
    syncErrorMessage,
    loading,
    refresh,
    markOneRead,
    markAllRead,
    clearReadOnly
  } = useOwnedNotifications();
  const hasUnread = unreadCount > 0;
  const visibleNotifications = useMemo(() => displayNotifications(notifications), [notifications]);
  const groupedNotifications = useMemo(() => grouped(visibleNotifications), [visibleNotifications]);
  const selected = useMemo(() => visibleNotifications.find((item) => item.id === selectedId) || null, [selectedId, visibleNotifications]);
  const headerText = useMemo(() => hasUnread ? `${unreadCount} unread` : 'All caught up', [hasUnread, unreadCount]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const openSelected = async (item: DisplayNotification) => {
    if (!item.href || item.href === '#') {
      await markOneRead(item.id);
      setSelectedId(null);
      return;
    }
    await markOneRead(item.id);
    setSelectedId(null);
    setOpen(false);
    router.push(item.href);
  };

  return <div className="notification-dock" data-notification-dock="true" data-notification-realtime="owned-hook-fetch-first-realtime-accelerated">
    <style data-notification-dock-owner="true">{OWNED_NOTIFICATION_DOCK_CSS}</style>
    <button type="button" className={`notification-dock-button ${hasUnread ? 'has-unread' : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-label="Open notifications" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">🔔</span>
      {hasUnread && <strong className="notification-dock-badge">{unreadCount > 99 ? '99+' : unreadCount}</strong>}
    </button>
    {open && <section className="notification-dock-popover" role="dialog" aria-label="Notifications">
      <header className="notification-dock-header">
        <span className="notification-dock-header-copy"><strong>Notifications</strong><small>{loading ? 'Refreshing…' : headerText}</small></span>
        <button type="button" className="notification-dock-close" onClick={() => { setSelectedId(null); setOpen(false); }} aria-label="Close notifications">×</button>
      </header>
      <div className="notification-dock-actions" aria-label="Notification actions">
        <button type="button" className="notification-dock-action" onClick={() => void refresh()}>Refresh</button>
        <button type="button" className="notification-dock-action" onClick={() => void markAllRead()}>Mark all read</button>
        <button type="button" className="notification-dock-action danger" onClick={() => void clearReadOnly()}>Clear read only</button>
      </div>
      {syncErrorMessage && <p className="notification-dock-sync-warning">Sync warning: {syncErrorMessage}</p>}
      {errorMessage && <p className="notification-dock-empty">{errorMessage}</p>}
      {!errorMessage && visibleNotifications.length === 0 && <p className="notification-dock-empty">No notifications yet.</p>}
      {!errorMessage && groupedNotifications.length > 0 && <div className="notification-dock-list">
        {groupedNotifications.map(([group, items]) => (
          <section key={group} className="notification-dock-group" aria-label={group}>
            <div className="notification-dock-group-title">{group}</div>
            {items.map((item) => (
              <button key={item.id} type="button" className={`notification-dock-row ${item.severity} ${item.read_at ? 'read' : 'unread'}`} onClick={() => setSelectedId(item.id)} aria-label={`Open notification details for ${item.title}`}>
                <span className="notification-dock-dot" aria-hidden="true" />
                <span className="notification-dock-row-main"><span className="notification-dock-row-title">{item.title}</span><span className="notification-dock-row-meta">{item.summary} · {relativeTime(item.created_at)}</span></span>
                <span className="notification-dock-row-state">{item.read_at ? 'Read' : 'Unread'}</span>
              </button>
            ))}
          </section>
        ))}
      </div>}
      {selected && <div className="notification-dock-detail-backdrop" role="dialog" aria-label="Notification details">
        <section className="notification-dock-detail">
          <header className="notification-dock-detail-head">
            <span className="notification-dock-detail-title"><strong>{selected.title}</strong><small>{selected.group} · {selected.read_at ? 'Read' : 'Unread'}</small></span>
            <button type="button" className="notification-dock-detail-close" onClick={() => setSelectedId(null)} aria-label="Close notification details">×</button>
          </header>
          <div className="notification-dock-detail-context">
            {selected.context.map((line) => <span key={`${selected.id}-${line.label}`} className="notification-dock-context-line"><b>{line.label}</b><span>{line.value}</span></span>)}
          </div>
          <footer className="notification-dock-detail-footer">
            <span className="notification-dock-time">{relativeTime(selected.created_at)} · {phDateTime(selected.created_at)} PH</span>
            <button type="button" className="notification-dock-open-button" onClick={() => void openSelected(selected)}>{selected.actionLabel}</button>
          </footer>
        </section>
      </div>}
    </section>}
  </div>;
}
