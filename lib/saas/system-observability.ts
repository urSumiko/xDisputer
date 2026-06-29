import type { NextRequest } from 'next/server';
import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SystemEvent = {
  id: string;
  request_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  route_path: string;
  event_type: string;
  event_status: string;
  duration_ms: number | null;
  safe_message: string | null;
  created_at: string;
};

export function requestIdFrom(request?: NextRequest) {
  return request?.headers.get('x-request-id')
    || request?.headers.get('x-vercel-id')
    || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readObjectMessage(value: Record<string, unknown>) {
  const fields = ['message', 'error_description', 'error', 'details', 'hint', 'code'];
  const parts = fields
    .map((field) => value[field])
    .filter((item) => typeof item === 'string' && item.trim().length > 0) as string[];
  return parts.length ? parts.join(' · ').slice(0, 300) : null;
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  if (typeof error === 'string') return error.slice(0, 300);
  if (error && typeof error === 'object') {
    const message = readObjectMessage(error as Record<string, unknown>);
    if (message) return message;
  }
  return 'Unknown error';
}

export async function logSystemEvent(
  supabase: SupabaseServerClient,
  input: {
    requestId?: string | null;
    routePath: string;
    eventType: string;
    eventStatus?: 'info' | 'success' | 'warning' | 'error';
    durationMs?: number | null;
    safeMessage?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.rpc('app_log_system_event', {
    request_id_input: input.requestId || null,
    route_path_input: input.routePath,
    event_type_input: input.eventType,
    event_status_input: input.eventStatus || 'info',
    duration_ms_input: typeof input.durationMs === 'number' ? Math.round(input.durationMs) : null,
    safe_message_input: input.safeMessage || null,
    metadata_json_input: input.metadata || {}
  });

  // Observability must never break the user flow.
  return error?.message || null;
}

export async function listMasterSystemEvents(
  supabase: SupabaseServerClient,
  limit = 100
) {
  const { data, error } = await supabase.rpc('access_master_system_events', {
    limit_count: limit
  });

  return {
    events: Array.isArray(data) ? data as SystemEvent[] : [],
    errorMessage: error?.message || null
  };
}
