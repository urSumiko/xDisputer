'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from '../../lib/supabase/browser';

const OUTPUT_ACTIVITY_PATH = '/admin/output-activity-v2';
const MIN_REFRESH_INTERVAL_MS = 12_000;
const REFRESH_DELAY_MS = 750;

export default function OutputActivityRealtimeRefreshMount() {
  const pathname = usePathname();
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (pathname !== OUTPUT_ACTIVITY_PATH || !hasSupabaseBrowserEnv()) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const supabase = createSupabaseBrowserClient();

    function scheduleRefresh(reason = 'event') {
      if (cancelled || refreshTimer.current) return;
      const elapsed = Date.now() - lastRefreshAt.current;
      const delay = elapsed > MIN_REFRESH_INTERVAL_MS ? REFRESH_DELAY_MS : MIN_REFRESH_INTERVAL_MS - elapsed;
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        if (cancelled) return;
        lastRefreshAt.current = Date.now();
        router.refresh();
        window.dispatchEvent(new CustomEvent('xdisputer:output-activity-route-refreshed', { detail: { reason } }));
      }, delay);
    }

    const focusHandler = () => scheduleRefresh('focus');
    const notificationHandler = () => scheduleRefresh('xdisputer:notifications-refreshed');
    const visibilityHandler = () => { if (!document.hidden) scheduleRefresh('visibility'); };

    window.addEventListener('focus', focusHandler);
    window.addEventListener('online', focusHandler);
    window.addEventListener('xdisputer:notifications-refreshed', notificationHandler);
    document.addEventListener('visibilitychange', visibilityHandler);

    void supabase.auth.getUser().then(({ data }) => {
      const managerId = data.user?.id;
      if (!managerId || cancelled) return;
      channel = supabase
        .channel(`output-activity-realtime-${managerId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'manager_disputer_output_approvals', filter: `manager_id=eq.${managerId}` },
          () => scheduleRefresh('output-activity-realtime')
        );
      void channel.subscribe();
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      window.removeEventListener('focus', focusHandler);
      window.removeEventListener('online', focusHandler);
      window.removeEventListener('xdisputer:notifications-refreshed', notificationHandler);
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [pathname, router]);

  return null;
}
