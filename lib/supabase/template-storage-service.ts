import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './admin';

export type TemplateStorageOperation = 'download' | 'upload' | 'remove';

export type TemplateStorageResult<T> = {
  data: T | null;
  error: { message: string } | null;
  mode: 'service-role' | 'session';
};

function hasServiceRoleEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function storageClient(sessionSupabase: SupabaseClient) {
  if (!hasServiceRoleEnv()) return { client: sessionSupabase, mode: 'session' as const };

  return { client: createSupabaseAdminClient(), mode: 'service-role' as const };
}

function normalizeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return { message: error.message };
  if (typeof error === 'object' && 'message' in error) return { message: String((error as { message?: unknown }).message || 'Unknown storage error') };
  return { message: String(error) };
}

export async function downloadManagerTemplateObject(input: {
  sessionSupabase: SupabaseClient;
  bucket: string;
  path: string;
}): Promise<TemplateStorageResult<Blob>> {
  const { client, mode } = storageClient(input.sessionSupabase);

  try {
    const response = await client.storage.from(input.bucket).download(input.path);
    return { data: response.data || null, error: normalizeError(response.error), mode };
  } catch (error) {
    return { data: null, error: normalizeError(error), mode };
  }
}

export async function uploadManagerTemplateObject(input: {
  sessionSupabase: SupabaseClient;
  bucket: string;
  path: string;
  body: Blob | ArrayBuffer | Uint8Array;
  contentType: string;
  upsert?: boolean;
}): Promise<TemplateStorageResult<{ path: string }>> {
  const { client, mode } = storageClient(input.sessionSupabase);

  try {
    const response = await client.storage.from(input.bucket).upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: input.upsert || false
    });

    return { data: response.data || null, error: normalizeError(response.error), mode };
  } catch (error) {
    return { data: null, error: normalizeError(error), mode };
  }
}

export async function removeManagerTemplateObjects(input: {
  sessionSupabase: SupabaseClient;
  bucket: string;
  paths: string[];
}): Promise<TemplateStorageResult<unknown[]>> {
  const { client, mode } = storageClient(input.sessionSupabase);

  if (!input.paths.length) return { data: [], error: null, mode };

  try {
    const response = await client.storage.from(input.bucket).remove(input.paths);
    return { data: response.data || null, error: normalizeError(response.error), mode };
  } catch (error) {
    return { data: null, error: normalizeError(error), mode };
  }
}

export function managerTemplateStorageMode() {
  return hasServiceRoleEnv() ? 'service-role' : 'session';
}
