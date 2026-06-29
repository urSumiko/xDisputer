'use client';

import { useEffect } from 'react';

type FetchRecord = {
  hits: number;
  firstAt: number;
  lastAt: number;
};

const WINDOW_MS = 10_000;
const WARNING_THRESHOLD = 12;
const WATCHED_PATHS = [
  '/api/notifications',
  '/api/client/output-entitlement',
  '/api/manager/output-activity',
  '/admin/output-activity-v2'
];

function watchedUrl(input: RequestInfo | URL) {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  try {
    const url = new URL(raw, window.location.origin);
    return WATCHED_PATHS.some((path) => url.pathname === path) ? url.pathname : null;
  } catch {
    return null;
  }
}

export default function FetchLoopDetectorMount() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;
    if ((window as unknown as { __xdisputerFetchLoopDetector?: boolean }).__xdisputerFetchLoopDetector) return;
    (window as unknown as { __xdisputerFetchLoopDetector?: boolean }).__xdisputerFetchLoopDetector = true;

    const originalFetch = window.fetch.bind(window);
    const records = new Map<string, FetchRecord>();

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const pathname = watchedUrl(input);
      if (pathname) {
        const now = Date.now();
        const current = records.get(pathname);
        const next = !current || now - current.firstAt > WINDOW_MS
          ? { hits: 1, firstAt: now, lastAt: now }
          : { hits: current.hits + 1, firstAt: current.firstAt, lastAt: now };
        records.set(pathname, next);
        if (next.hits === WARNING_THRESHOLD) {
          console.warn(`[xDisputer stability] High fetch frequency for ${pathname}: ${next.hits} hits in ${Math.round((next.lastAt - next.firstAt) / 1000)}s`);
        }
      }
      return originalFetch(input, init);
    };

    const cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [key, record] of records.entries()) {
        if (now - record.lastAt > WINDOW_MS) records.delete(key);
      }
    }, WINDOW_MS);

    return () => {
      window.clearInterval(cleanupTimer);
      window.fetch = originalFetch;
      (window as unknown as { __xdisputerFetchLoopDetector?: boolean }).__xdisputerFetchLoopDetector = false;
    };
  }, []);

  return null;
}
