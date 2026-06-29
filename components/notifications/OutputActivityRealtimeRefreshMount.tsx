'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

const OUTPUT_ACTIVITY_PATH = '/admin/output-activity-v2';

export default function OutputActivityRealtimeRefreshMount() {
  const pathname = usePathname();
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (pathname !== OUTPUT_ACTIVITY_PATH) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const supabase = createSupabaseBrowserClient();

    function scheduleRefresh(reason = 'event') {
      if (cancelled || refreshTimer.current) return;
      const elapsed = Date.now() - lastRefreshAt.current;
      const delay = elapsed > 1500 ? 350 : 1500 - elapsed;
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        if (cancelled) return;
        lastRefreshAt.current = Date.now();
        router.refresh();
        window.dispatchEvent(new CustomEvent('xdisputer:output-activity-route-refreshed', { detail: { reason } }));
      }, delay);
    }

    const focusHandler = () => scheduleRefresh('focus');
    const visibilityHandler = () => { if (!document.hidden) scheduleRefresh('visibility'); };
    const notificationHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { outputActivityUnreadCount?: number } | undefined;
      if (!detail || Number(detail.outputActivityUnreadCount || 0) > 0) scheduleRefresh('notifications-refreshed');
    };

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
      void channel.subscribe((status) => { if (status === 'SUBSCRIBED') scheduleRefresh('subscribed'); });
    }).catch(() => undefined);

    scheduleRefresh('mount');

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
