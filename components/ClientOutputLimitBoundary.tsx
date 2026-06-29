'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '../lib/supabase/browser';
import { PageStateBoundary, StableCard, StableEmptyState } from './stability';

type EntitlementPayload = { outputLimit: number | null; managerDefaultOutputLimit?: number | null; managerDisputerLimit?: number | null; managerLimitUpdatedAt?: string | null; outputUsedToday: number; outputRemainingToday: number | null; resetAt: string | null; resetSeconds: number | null; allowed: boolean; message: string | null; managerId?: string | null; source?: string | null; serverTime?: string | null };
type EntitlementState = 'checking' | 'allowed' | 'paused' | 'unavailable';

const ENTITLEMENT_FETCH_TIMEOUT_MS = 8000;

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'Calculating';
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secondsPart = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secondsPart}s`;
  if (minutes > 0) return `${minutes}m ${secondsPart}s`;
  return `${secondsPart}s`;
}

function formatResetAt(value: string | null) {
  if (!value) return '12:00 AM US ET';
  try { return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(value))} US ET`; }
  catch { return '12:00 AM US ET'; }
}

function formatSyncTime(value: string | null | undefined) {
  if (!value) return null;
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
  catch { return null; }
}

function isEntitlementPayload(value: unknown): value is EntitlementPayload { return Boolean(value && typeof value === 'object' && 'outputUsedToday' in value); }
function countdownStep(secondsLeft: number | null) { if (secondsLeft === null || secondsLeft > 3600) return { delay: 60_000, decrement: 60 }; if (secondsLeft > 300) return { delay: 10_000, decrement: 10 }; return { delay: 1000, decrement: 1 }; }
function isPaused(entitlement: EntitlementPayload | null) { return Boolean(entitlement && (entitlement.allowed === false || (entitlement.outputLimit !== null && entitlement.outputRemainingToday === 0))); }
function resolveState(entitlement: EntitlementPayload | null, unavailable: boolean): EntitlementState { if (unavailable && !entitlement) return 'unavailable'; if (!entitlement) return 'checking'; return isPaused(entitlement) ? 'paused' : 'allowed'; }
function disputerMessage(value: string | null | undefined) { return (value || 'Generation is paused for this Disputer account.').replace(/client user/gi, 'Disputer').replace(/client account/gi, 'Disputer account').replace(/client output/gi, 'Disputer output').replace(/client\b/gi, 'Disputer'); }

export default function ClientOutputLimitBoundary({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlement] = useState<EntitlementPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const entitlementRef = useRef<EntitlementPayload | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyEntitlement = useCallback((next: EntitlementPayload) => {
    entitlementRef.current = next;
    setUnavailable(false);
    setEntitlement(next);
    setSecondsLeft(typeof next.resetSeconds === 'number' ? next.resetSeconds : null);
  }, []);

  const markUnavailableIfCold = useCallback(() => {
    if (!entitlementRef.current) setUnavailable(true);
  }, []);

  const load = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ENTITLEMENT_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/client/output-entitlement?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json', 'cache-control': 'no-store' } });
      if (!response.ok) { markUnavailableIfCold(); return; }
      const payload = await response.json();
      const next = payload.entitlement as EntitlementPayload | undefined;
      if (!next) { markUnavailableIfCold(); return; }
      applyEntitlement(next);
    } catch { markUnavailableIfCold(); }
    finally { window.clearTimeout(timeout); }
  }, [applyEntitlement, markUnavailableIfCold]);

  const scheduleRefresh = useCallback((delay = 150) => {
    if (refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void load();
    }, delay);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const supabase = createSupabaseBrowserClient();
    const refresh = () => { if (!cancelled) scheduleRefresh(); };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (isEntitlementPayload(detail)) applyEntitlement(detail); else refresh();
    };
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('online', handleUpdate);
    window.addEventListener('xdisputer:output-entitlement-updated', handleUpdate);
    window.addEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      channel = supabase
        .channel(`client-output-entitlement-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_entitlement_limits', filter: `client_id=eq.${userId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_runs', filter: `owner_id=eq.${userId}` }, refresh);
      void channel.subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('online', handleUpdate);
      window.removeEventListener('xdisputer:output-entitlement-updated', handleUpdate);
      window.removeEventListener('xdisputer:output-entitlement-refresh', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [applyEntitlement, scheduleRefresh]);

  useEffect(() => {
    const managerId = entitlement?.managerId;
    if (!managerId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    const channel = supabase
      .channel(`client-manager-entitlement-${managerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_entitlement_limits', filter: `manager_id=eq.${managerId}` }, () => { if (!cancelled) scheduleRefresh(0); })
      .subscribe((status) => { if (status === 'SUBSCRIBED' && !cancelled) scheduleRefresh(0); });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [entitlement?.managerId, scheduleRefresh]);

  const state = resolveState(entitlement, unavailable);
  const paused = state === 'paused';
  useEffect(() => { if (!paused || typeof secondsLeft !== 'number') return; const step = countdownStep(secondsLeft); const timer = window.setTimeout(() => setSecondsLeft((value) => typeof value === 'number' ? Math.max(0, value - step.decrement) : value), step.delay); return () => window.clearTimeout(timer); }, [paused, secondsLeft]);
  useEffect(() => { if (secondsLeft === 0) scheduleRefresh(0); }, [secondsLeft, scheduleRefresh]);
  const usageLabel = useMemo(() => { if (!entitlement) return 'Checking daily output limit'; if (entitlement.outputLimit === null) return entitlement.managerId ? 'Manager output cap is not set' : 'Boss manager is not assigned'; return `${entitlement.outputUsedToday}/${entitlement.outputLimit} Daily Outputs Used`; }, [entitlement]);
  const managerLimitLabel = useMemo(() => { if (!entitlement) return 'Checking Master limit'; if (!entitlement.managerId) return 'No boss manager assigned'; if (entitlement.managerDefaultOutputLimit) return `Master-set manager cap: ${entitlement.managerDefaultOutputLimit} outputs/day`; return 'Master-set manager cap is missing'; }, [entitlement]);
  const managerSeatLabel = useMemo(() => { if (!entitlement?.managerDisputerLimit) return null; return `${entitlement.managerDisputerLimit} Disputer seats allowed for this manager`; }, [entitlement?.managerDisputerLimit]);
  const syncLabel = formatSyncTime(entitlement?.managerLimitUpdatedAt);
  if (state === 'checking') return <main className="client-output-limit-checking" aria-label="Checking Disputer output allowance" data-output-entitlement-state="checking"><PageStateBoundary state="loading" loading={<StableCard eyebrow="Workspace access" title="Checking daily output allowance" description="Preparing this Disputer workspace without showing unstable controls early." state="loading"><StableEmptyState tone="info" title="Loading entitlement" description="The workspace opens automatically after allowance is confirmed." /></StableCard>}>{children}</PageStateBoundary></main>;
  if (state === 'unavailable') return <main className="client-output-limit-checking" aria-label="Disputer output allowance unavailable" data-output-entitlement-state="unavailable"><StableCard tone="warning" eyebrow="Workspace access" title="Output allowance could not be verified" description="Generation controls stay hidden until the current allowance is confirmed." actions={<button type="button" className="action-button" onClick={() => scheduleRefresh(0)}>Check again</button>}><StableEmptyState tone="warning" title="Entitlement check unavailable" description="Reconnect or refresh before generating output." /></StableCard></main>;
  if (state === 'allowed') return <>{children}</>;
  return <main className="client-output-limit-pause" aria-label="Daily output limit reached" data-output-entitlement-sync="realtime-no-store" data-output-entitlement-state="paused"><section className="client-output-limit-pause-card"><p className="eyebrow">Daily allowance reached</p><h1>Workspace pauses until reset</h1><p>Daily output allowance follows the Master limit set on the assigned manager. The workspace opens again automatically after reset or after Master updates the manager default output cap.</p><div className="client-output-limit-pause-grid"><article><span>Usage today</span><strong>{usageLabel}</strong><small>{disputerMessage(entitlement?.message)}</small></article><article><span>Master manager limit</span><strong>{managerLimitLabel}</strong><small>{managerSeatLabel}{managerSeatLabel && syncLabel ? ' · ' : ''}{syncLabel ? `Synced ${syncLabel}` : ''}</small></article><article><span>Opens in</span><strong>{formatDuration(secondsLeft)}</strong><small>Reset at {formatResetAt(entitlement?.resetAt || null)}</small></article></div><button type="button" className="action-button" onClick={() => scheduleRefresh(0)}>Check again</button></section></main>;
}
