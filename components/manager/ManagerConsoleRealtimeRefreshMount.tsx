'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

const MANAGER_REFRESH_MIN_INTERVAL_MS = 8000;

export default function ManagerConsoleRealtimeRefreshMount() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (cancelled || timerRef.current) return;
      const elapsed = Date.now() - lastRefreshAtRef.current;
      const delay = elapsed >= MANAGER_REFRESH_MIN_INTERVAL_MS ? 900 : MANAGER_REFRESH_MIN_INTERVAL_MS - elapsed;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (cancelled) return;
        lastRefreshAtRef.current = Date.now();
        router.refresh();
      }, delay);
    };

    window.addEventListener('xdisputer:manager-console-refresh', scheduleRefresh);
    window.addEventListener('xdisputer:route-refresh', scheduleRefresh);

    void supabase.auth.getUser().then(({ data }) => {
      const managerId = data.user?.id;
      if (cancelled || !managerId) return;
      channel = supabase.channel(`manager-console-stable-sync-${managerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_manager_assignments', filter: `manager_id=eq.${managerId}` }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_user_settings', filter: `manager_id=eq.${managerId}` }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manager_entitlement_limits', filter: `manager_id=eq.${managerId}` }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_entitlement_limits', filter: `manager_id=eq.${managerId}` }, scheduleRefresh)
        .subscribe((status) => { if (status === 'SUBSCRIBED') scheduleRefresh(); });
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('xdisputer:manager-console-refresh', scheduleRefresh);
      window.removeEventListener('xdisputer:route-refresh', scheduleRefresh);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
