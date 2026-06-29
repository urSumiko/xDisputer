'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoRouteRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;

    const refresh = () => {
      if (timer) return;
      const elapsed = Date.now() - lastRefreshAt;
      const delay = elapsed > 1500 ? 300 : 1500 - elapsed;
      timer = window.setTimeout(() => {
        timer = null;
        lastRefreshAt = Date.now();
        router.refresh();
      }, delay);
    };

    const visibilityHandler = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('xdisputer:route-refresh', refresh);
    window.addEventListener('xdisputer:notifications-refreshed', refresh);
    window.addEventListener('xdisputer:output-entitlement-updated', refresh);
    window.addEventListener('xdisputer:output-entitlement-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('xdisputer:route-refresh', refresh);
      window.removeEventListener('xdisputer:notifications-refreshed', refresh);
      window.removeEventListener('xdisputer:output-entitlement-updated', refresh);
      window.removeEventListener('xdisputer:output-entitlement-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [router]);

  return null;
}
