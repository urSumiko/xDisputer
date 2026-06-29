'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationRecord } from '../../lib/notifications/notification-types';

type NotificationState = {
  notifications: NotificationRecord[];
  unreadCount: number;
  errorMessage?: string | null;
};

const emptyState: NotificationState = { notifications: [], unreadCount: 0 };

function severityLabel(value: NotificationRecord['severity']) {
  if (value === 'success') return 'Success';
  if (value === 'warning') return 'Warning';
  if (value === 'error') return 'Action needed';
  return 'Info';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function NotificationBell() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NotificationState>(emptyState);
  const [loading, setLoading] = useState(false);
  const popoverId = useMemo(() => 'xdisputer-notification-popover', []);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      setLoading(true);
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as NotificationState;
        if (active) setState({ notifications: payload.notifications || [], unreadCount: payload.unreadCount || 0, errorMessage: payload.errorMessage });
      } finally {
        if (active) setLoading(false);
      }
    }
    loadNotifications();
    return () => { active = false; };
  }, []);

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

  async function markRead() {
    await fetch('/api/notifications/read', { method: 'POST' });
    const readAt = new Date().toISOString();
    setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at || readAt })), unreadCount: 0 }));
  }

  return <div ref={rootRef} className="topbar-notification-root" data-topbar-notification="true" data-notification-state={open ? 'open' : 'closed'}>
    <button type="button" className="topbar-icon-button notification-bell-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} aria-label="Open notifications" onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">N</span>
      {state.unreadCount ? <strong aria-label={`${state.unreadCount} unread notifications`}>{state.unreadCount > 9 ? '9+' : state.unreadCount}</strong> : null}
    </button>
    {open ? <div id={popoverId} className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-popover-topline"><span>Notifications</span><button type="button" onClick={markRead}>Mark read</button></div>
      {loading ? <p className="notification-empty">Loading latest notifications...</p> : null}
      {!loading && state.errorMessage ? <p className="notification-empty">Notifications unavailable: {state.errorMessage}</p> : null}
      {!loading && !state.errorMessage && !state.notifications.length ? <p className="notification-empty">No notifications yet.</p> : null}
      <div className="notification-list">
        {state.notifications.map((item) => <a key={item.id} className="notification-item" href={item.href || '#'} data-notification-read={item.read_at ? 'true' : 'false'} data-notification-severity={item.severity}>
          <span>{severityLabel(item.severity)}</span>
          <strong>{item.title}</strong>
          {item.body ? <small>{item.body}</small> : null}
          <em>{formatTime(item.created_at)}</em>
        </a>)}
      </div>
    </div> : null}
  </div>;
}
