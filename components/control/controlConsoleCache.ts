'use client';

export type ControlCacheEntry = {
  href: string;
  status: 'idle' | 'warming' | 'warm' | 'error';
  warmedAt: number | null;
  errorMessage?: string;
};

const cache = new Map<string, ControlCacheEntry>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getControlCacheSnapshot() {
  return Array.from(cache.values());
}

export function subscribeControlCache(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markControlRouteIdle(href: string) {
  if (!cache.has(href)) cache.set(href, { href, status: 'idle', warmedAt: null });
}

export function markControlRouteWarm(href: string) {
  cache.set(href, { href, status: 'warm', warmedAt: Date.now() });
  emit();
}

export function markControlRouteError(href: string, error: unknown) {
  cache.set(href, {
    href,
    status: 'error',
    warmedAt: null,
    errorMessage: error instanceof Error ? error.message : String(error)
  });
  emit();
}

export function shouldWarmControlRoute(href: string, maxAgeMs = 45_000) {
  const entry = cache.get(href);
  if (!entry) return true;
  if (entry.status === 'warming') return false;
  if (entry.status === 'error') return true;
  if (entry.status !== 'warm' || !entry.warmedAt) return true;
  return Date.now() - entry.warmedAt > maxAgeMs;
}

export function warmControlRoute(href: string, prefetch: (href: string) => void) {
  if (!shouldWarmControlRoute(href)) return;
  cache.set(href, { href, status: 'warming', warmedAt: null });
  emit();
  try {
    prefetch(href);
    markControlRouteWarm(href);
  } catch (error) {
    markControlRouteError(href, error);
  }
}
