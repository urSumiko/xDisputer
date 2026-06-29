'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { markControlRouteIdle, warmControlRoute } from './controlConsoleCache';

export type ControlNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type PendingNavigation = {
  href: string;
  label: string;
  startedAt: number;
};

function routeKey(pathname: string, searchParams: { toString(): string } | null) {
  const query = searchParams?.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

function hrefKey(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

export default function ControlNavigationTelemetry({ scope, navItems }: { scope: string; navItems: ControlNavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingRef = useRef<PendingNavigation | null>(null);
  const currentRoute = useMemo(() => routeKey(pathname, searchParams), [pathname, searchParams]);
  const navHrefs = useMemo(() => Array.from(new Set(navItems.map((item) => item.href))), [navItems]);

  useEffect(() => {
    navHrefs.forEach(markControlRouteIdle);
    const id = window.setTimeout(() => {
      navHrefs.forEach((href) => warmControlRoute(href, router.prefetch));
    }, 150);
    return () => window.clearTimeout(id);
  }, [navHrefs, router.prefetch]);

  useEffect(() => {
    function handleStart(event: Event) {
      const detail = (event as CustomEvent).detail || {};
      const href = String(detail.href || '');
      if (!href) return;
      pendingRef.current = {
        href,
        label: String(detail.label || href),
        startedAt: performance.now()
      };
      performance.mark(`xdisputer-control-nav-start-${scope}`);
    }

    window.addEventListener('xdisputer:control-nav-start', handleStart);
    return () => window.removeEventListener('xdisputer:control-nav-start', handleStart);
  }, [scope]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const expected = hrefKey(pending.href);
    if (currentRoute !== expected && !currentRoute.startsWith(expected)) return;
    const durationMs = Math.round(performance.now() - pending.startedAt);
    performance.mark(`xdisputer-control-nav-finish-${scope}`);
    window.dispatchEvent(new CustomEvent('xdisputer:control-nav-finish', {
      detail: { scope, href: pending.href, label: pending.label, durationMs, route: currentRoute }
    }));
    if (process.env.NODE_ENV !== 'production') {
      console.info('[xDisputer nav]', { scope, label: pending.label, durationMs, route: currentRoute });
    }
    pendingRef.current = null;
  }, [currentRoute, scope]);

  return null;
}
