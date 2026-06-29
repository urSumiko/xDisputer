'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';

type PendingNav = {
  href: string;
  label: string;
  source: string;
  startedAt: number;
};

function routeKey(pathname: string) {
  if (typeof window === 'undefined') return pathname;
  return `${pathname}${window.location.search || ''}`;
}

function hrefKey(href: string) {
  if (typeof window === 'undefined') return href;
  try {
    const url = new URL(href, window.location.origin);
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch {
    return href;
  }
}

function isControlHref(href: string) {
  return href.startsWith('/master') || href.startsWith('/admin');
}

export default function ControlNavGlobalTelemetry() {
  const pathname = usePathname();
  const pendingRef = useRef<PendingNav | null>(null);
  const currentRoute = useMemo(() => routeKey(pathname), [pathname]);

  useEffect(() => {
    function handleStart(event: Event) {
      const detail = (event as CustomEvent).detail || {};
      const href = String(detail.href || '');
      if (!href || !isControlHref(href)) return;
      const label = String(detail.label || href);
      const source = String(detail.source || 'control-nav');
      pendingRef.current = { href, label, source, startedAt: performance.now() };
      console.info('[xDisputer nav:start]', { href, label, source });
    }

    window.addEventListener('xdisputer:control-nav-start', handleStart);
    return () => window.removeEventListener('xdisputer:control-nav-start', handleStart);
  }, []);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const expected = hrefKey(pending.href);
    if (currentRoute !== expected && !currentRoute.startsWith(expected)) return;
    const durationMs = Math.round(performance.now() - pending.startedAt);
    console.info('[xDisputer nav]', {
      scope: pending.href.startsWith('/master') ? 'master' : 'manager',
      label: pending.label,
      durationMs,
      route: currentRoute
    });
    pendingRef.current = null;
  }, [currentRoute]);

  return null;
}
