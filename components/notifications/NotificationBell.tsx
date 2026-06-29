'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationRecord } from '../../lib/notifications/notification-types';
import { useOwnedNotifications } from '../../src/features/notifications/useOwnedNotifications';

function severityLabel(value: NotificationRecord['severity']) {
  if (value === 'success') return 'Success';
  if (value === 'warning') return 'Warning';
  if (value === 'error') return 'Action needed';
  return 'Info';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time not recorded';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date) + ' PH';
}

function NotificationContent({ item }: { item: NotificationRecord }) {
  return <>
    <span>{severityLabel(item.severity)}</span>
    <strong>{item.title}</strong>
    {item.body ? <small>{item.body}</small> : null}
    <em>{formatTime(item.created_at)}</em>
  </>;
}

export default function NotificationBell() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const popoverId = useMemo(() => 'xdisputer-notification-popover', []);
  const { notifications, unreadCount, errorMessage, syncErrorMessage, loading, refresh, markOneRead, markAllRead } = useOwnedNotifications();

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    function refreshFromGlobalEvent() { void refresh(); }
    window.addEventListener('xdisputer:output-entitlement-updated', refreshFromGlobalEvent);
    window.addEventListener('xdisputer:output-activity-route-refreshed', refreshFromGlobalEvent);
    return () => {
      window.removeEventListener('xdisputer:output-entitlement-updated', refreshFromGlobalEvent);
      window.removeEventListener('xdisputer:output-activity-route-refreshed', refreshFromGlobalEvent);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function openNotification(item: NotificationRecord) {
    await markOneRead(item.id);
    if (!item.href) return;
    setOpen(false);
  }

  return <div ref={rootRef} className="topbar-notification-root" data-topbar-notification="true" data-notification-state={open ? 'open' : 'closed'}>
    <button type="button" className="topbar-icon-button notification-bell-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} aria-label="Open notifications" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">🔔</span>
      {unreadCount ? <strong aria-label={`${unreadCount} unread notifications`}>{unreadCount > 9 ? '9+' : unreadCount}</strong> : null}
    </button>
    {open ? <div id={popoverId} className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-popover-topline"><span>Notifications</span><button type="button" onClick={() => void markAllRead()}>Mark read</button></div>
      {loading ? <p className="notification-empty">Loading latest notifications...</p> : null}
      {!loading && errorMessage ? <p className="notification-empty">Notifications unavailable: {errorMessage}</p> : null}
      {!loading && !errorMessage && syncErrorMessage ? <p className="notification-empty">Notification sync is repairing. Latest output activity will still appear below.</p> : null}
      {!loading && !errorMessage && !notifications.length ? <p className="notification-empty">No notifications yet.</p> : null}
      <div className="notification-list">
        {notifications.map((item) => item.href ? <a key={item.id} className="notification-item" href={item.href} data-notification-read={item.read_at ? 'true' : 'false'} data-notification-severity={item.severity} onClick={() => void openNotification(item)}>
          <NotificationContent item={item} />
          <b className="notification-open-label">Open</b>
        </a> : <article key={item.id} className="notification-item notification-item-static" data-notification-read={item.read_at ? 'true' : 'false'} data-notification-severity={item.severity}>
          <NotificationContent item={item} />
          {!item.read_at ? <button type="button" className="notification-open-label" onClick={() => void markOneRead(item.id)}>Mark read</button> : null}
        </article>)}
      </div>
    </div> : null}
  </div>;
}
