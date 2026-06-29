'use client';

import { createBrowserClient } from '@supabase/ssr';

export const SUPABASE_BROWSER_ENV_ERROR =
  'Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is also accepted as the public anon/publishable key fallback.';

export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  return {
    url,
    anonKey,
    ready: Boolean(url && anonKey)
  };
}

export function hasSupabaseBrowserEnv() {
  return getSupabaseBrowserEnv().ready;
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();

  if (!url || !anonKey) {
    throw new Error(SUPABASE_BROWSER_ENV_ERROR);
  }

  return createBrowserClient(url, anonKey);
}
