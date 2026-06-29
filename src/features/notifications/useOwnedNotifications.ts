'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { NotificationRecord } from '../../../lib/notifications/notification-types';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser';
import { notificationOwnershipContract } from './notification-ownership-contract';

type Snapshot = {
  notifications: NotificationRecord[];
  unreadCount: number;
  outputActivityUnreadCount: number;
  errorMessage: string | null;
  syncErrorMessage: string | null;
  serverTime: string | null;
  loading: boolean;
};

type RefreshReason = 'mount' | 'manual' | 'focus' | 'visibility' | 'realtime' | 'warmup' | 'steady' | 'read-action' | 'auth-change';

type LocalNotificationState = {
  read: Record<string, string>;
  cleared: Record<string, true>;
};

const EMPTY_SNAPSHOT: Snapshot = {
  notifications: [],
  unreadCount: 0,
  outputActivityUnreadCount: 0,
  errorMessage: null,
  syncErrorMessage: null,
  serverTime: null,
  loading: false
};

const OUTPUT_ACTIVITY_HREF = '/admin/output-activity-v2';
const STORAGE_PREFIX = 'xdisputer-notification-state-v2';
const UUID_RE = /^[0-9a-f-]{36}$/i;
const subscribers = new Set<() => void>();
let snapshot = EMPTY_SNAPSHOT;
let started = false;
let inFlight = false;
let channel: RealtimeChannel | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let warmupTimer: ReturnType<typeof setInterval> | null = null;
let warmupStopTimer: ReturnType<typeof setTimeout> | null = null;
let steadyTimer: ReturnType<typeof setInterval> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;
let authUnsubscribe: (() => void) | null = null;

function countOutputActivityUnread(notifications: NotificationRecord[]) {
  return notifications.filter((item) => !item.read_at && (item.href || '').includes(OUTPUT_ACTIVITY_HREF)).length;
}

function storageKey(userId = currentUserId) {
  return `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

function readLocalState(): LocalNotificationState {
  if (typeof window === 'undefined') return { read: {}, cleared: {} };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || '{}') as Partial<LocalNotificationState>;
    return { read: parsed.read || {}, cleared: parsed.cleared || {} };
  } catch {
    return { read: {}, cleared: {} };
  }
}

function writeLocalState(next: LocalNotificationState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(), JSON.stringify(next));
}

function notificationKey(item: Pick<NotificationRecord, 'id' | 'href'>) {
  return item.href || item.id;
}

function applyLocalState(input: NotificationRecord[]) {
  const local = readLocalState();
  return input
    .filter((item) => !local.cleared[notificationKey(item)] && !local.cleared[item.id])
    .map((item) => {
      const readAt = local.read[notificationKey(item)] || local.read[item.id];
      return readAt && !item.read_at ? { ...item, read_at: readAt } : item;
    });
}

function snapshotSignature(value: Snapshot) {
  return JSON.stringify({
    ids: value.notifications.map((item) => `${item.id}:${item.read_at || ''}:${item.href || ''}`),
    unreadCount: value.unreadCount,
    errorMessage: value.errorMessage,
    syncErrorMessage: value.syncErrorMessage
  });
}

function normalizePayload(data: unknown): Snapshot {
  const input = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const rawNotifications = Array.isArray(input.notifications) ? input.notifications as NotificationRecord[] : [];
  const notifications = applyLocalState(rawNotifications);
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  return {
    notifications,
    unreadCount,
    outputActivityUnreadCount: countOutputActivityUnread(notifications),
    errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : null,
    syncErrorMessage: typeof input.syncErrorMessage === 'string' ? input.syncErrorMessage : null,
    serverTime: typeof input.serverTime === 'string' ? input.serverTime : null,
    loading: false
  };
}

function emit(next: Snapshot, reason: RefreshReason) {
  const previous = snapshot;
  const changed = snapshotSignature(previous) !== snapshotSignature(next);
  snapshot = next;
  subscribers.forEach((listener) => listener());
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('xdisputer:notifications-refreshed', {
      detail: { reason, unreadCount: next.unreadCount, outputActivityUnreadCount: next.outputActivityUnreadCount, serverTime: next.serverTime, userId: currentUserId }
    }));
  }
}

function updateCurrentNotifications(nextItems: NotificationRecord[], reason: RefreshReason = 'read-action') {
  emit({
    ...snapshot,
    notifications: nextItems,
    unreadCount: nextItems.filter((item) => !item.read_at).length,
    outputActivityUnreadCount: countOutputActivityUnread(nextItems),
    loading: false
  }, reason);
}

async function removeOwnedChannel(supabase: SupabaseClient) {
  if (!channel) return;
  const owned = channel;
  channel = null;
  await supabase.removeChannel(owned).catch(() => undefined);
}

function subscribeUserChannel(supabase: SupabaseClient, userId: string | null) {
  void removeOwnedChannel(supabase).then(() => {
    if (!userId || !started) return;
    channel = supabase
      .channel(`owned-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` }, () => scheduleRefresh('realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_disputer_output_approvals' }, () => scheduleRefresh('realtime'))
      .subscribe((status) => { if (status === 'SUBSCRIBED') scheduleRefresh('realtime'); });
  });
}

function setCurrentUser(supabase: SupabaseClient, userId: string | null, reason: RefreshReason) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  inFlight = false;
  emit(userId ? { ...EMPTY_SNAPSHOT, loading: true } : EMPTY_SNAPSHOT, reason);
  subscribeUserChannel(supabase, userId);
  if (userId) scheduleRefresh(reason, 0);
}

async function fetchNotifications(reason: RefreshReason = 'manual') {
  if (inFlight || typeof window === 'undefined') return;
  inFlight = true;
  if (!snapshot.loading) emit({ ...snapshot, loading: true }, reason);
  try {
    const response = await fetch(`/api/notifications?limit=${notificationOwnershipContract.maxVisibleItems}&t=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'cache-control': 'no-store' }
    });
    if (response.status === 401) {
      currentUserId = null;
      emit({ ...EMPTY_SNAPSHOT, errorMessage: 'Sign in again to load notifications.' }, reason);
      return;
    }
    const data = await response.json().catch(() => null);
    emit(normalizePayload(data), reason);
  } catch {
    emit({ ...snapshot, loading: false, errorMessage: 'Notifications unavailable.' }, reason);
  } finally {
    inFlight = false;
  }
}

function scheduleRefresh(reason: RefreshReason, delay = 250) {
  if (typeof window === 'undefined') return;
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void fetchNotifications(reason);
  }, delay);
}

function clearTimers() {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  if (warmupTimer) window.clearInterval(warmupTimer);
  if (warmupStopTimer) window.clearTimeout(warmupStopTimer);
  if (steadyTimer) window.clearInterval(steadyTimer);
  refreshTimer = null;
  warmupTimer = null;
  warmupStopTimer = null;
  steadyTimer = null;
}

function startController() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (teardownTimer) window.clearTimeout(teardownTimer);
  teardownTimer = null;

  const supabase = createSupabaseBrowserClient();
  const focusHandler = () => scheduleRefresh('focus');
  const visibilityHandler = () => { if (!document.hidden) scheduleRefresh('visibility'); };

  window.addEventListener('focus', focusHandler);
  window.addEventListener('online', focusHandler);
  document.addEventListener('visibilitychange', visibilityHandler);

  void supabase.auth.getUser().then(({ data }) => {
    setCurrentUser(supabase, data.user?.id || null, 'mount');
  }).catch(() => {
    setCurrentUser(supabase, null, 'mount');
  });

  const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
    setCurrentUser(supabase, session?.user?.id || null, 'auth-change');
  });
  authUnsubscribe = () => authSubscription.data.subscription.unsubscribe();

  warmupTimer = window.setInterval(() => scheduleRefresh('warmup'), 5_000);
  warmupStopTimer = window.setTimeout(() => {
    if (warmupTimer) window.clearInterval(warmupTimer);
    warmupTimer = null;
  }, 60_000);
  steadyTimer = window.setInterval(() => scheduleRefresh('steady'), notificationOwnershipContract.pollIntervalMs);

  const teardown = () => {
    window.removeEventListener('focus', focusHandler);
    window.removeEventListener('online', focusHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);
    clearTimers();
    authUnsubscribe?.();
    authUnsubscribe = null;
    void removeOwnedChannel(supabase);
    currentUserId = null;
    started = false;
  };

  (startController as unknown as { teardown?: () => void }).teardown = teardown;
}

function stopControllerSoon() {
  if (typeof window === 'undefined' || subscribers.size > 0) return;
  if (teardownTimer) window.clearTimeout(teardownTimer);
  teardownTimer = window.setTimeout(() => {
    if (subscribers.size > 0) return;
    (startController as unknown as { teardown?: () => void }).teardown?.();
    snapshot = EMPTY_SNAPSHOT;
  }, 30_000);
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  startController();
  return () => {
    subscribers.delete(listener);
    stopControllerSoon();
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function markLocalRead(id: string) {
  const local = readLocalState();
  const item = snapshot.notifications.find((notification) => notification.id === id || notification.href === id);
  const readAt = new Date().toISOString();
  local.read[id] = readAt;
  if (item) local.read[notificationKey(item)] = readAt;
  writeLocalState(local);
  updateCurrentNotifications(snapshot.notifications.map((notification) => {
    if (notification.id === id || (item && notificationKey(notification) === notificationKey(item))) return { ...notification, read_at: notification.read_at || readAt };
    return notification;
  }));
}

function markLocalAllRead() {
  const local = readLocalState();
  const readAt = new Date().toISOString();
  for (const item of snapshot.notifications) {
    local.read[item.id] = readAt;
    local.read[notificationKey(item)] = readAt;
  }
  writeLocalState(local);
  updateCurrentNotifications(snapshot.notifications.map((item) => ({ ...item, read_at: item.read_at || readAt })));
}

function clearLocalReadOnly() {
  const local = readLocalState();
  for (const item of snapshot.notifications) {
    if (item.read_at) {
      local.cleared[item.id] = true;
      local.cleared[notificationKey(item)] = true;
    }
  }
  writeLocalState(local);
  updateCurrentNotifications(snapshot.notifications.filter((item) => !item.read_at));
}

export function refreshOwnedNotifications() {
  return fetchNotifications('manual');
}

export function useOwnedNotifications() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const refresh = useCallback(() => fetchNotifications('manual'), []);
  const markOneRead = useCallback(async (id: string) => {
    markLocalRead(id);
    if (UUID_RE.test(id)) {
      await fetch(notificationOwnershipContract.readEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      }).catch(() => null);
      await fetchNotifications('read-action');
    }
  }, []);
  const markAllRead = useCallback(async () => {
    markLocalAllRead();
    await fetch(notificationOwnershipContract.readEndpoint, { method: 'POST' }).catch(() => null);
    await fetchNotifications('read-action');
  }, []);
  const clearReadOnly = useCallback(async () => {
    clearLocalReadOnly();
    await fetch(notificationOwnershipContract.clearReadEndpoint, { method: 'DELETE' }).catch(() => null);
    await fetchNotifications('read-action');
  }, []);

  return { ...current, refresh, markOneRead, markAllRead, clearReadOnly, currentUserId };
}
