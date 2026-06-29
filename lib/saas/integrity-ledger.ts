import { createHash } from 'crypto';
import type { createSupabaseServerClient } from '../supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type IntegrityInput = {
  generationRunId?: string | null;
  eventType: string;
  source?: unknown;
  template?: unknown;
  rules?: unknown;
  manifest?: unknown;
  output?: unknown;
  status?: 'recorded' | 'validated' | 'failed' | 'recovered';
  metadata?: Record<string, unknown>;
};

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = stableNormalize((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableNormalize(value));
}

export function sha256Digest(value: unknown) {
  const normalized = typeof value === 'string' ? value : stableStringify(value);
  return createHash('sha256').update(normalized || '').digest('hex');
}

function optionalHash(value: unknown) {
  if (typeof value === 'undefined' || value === null) return null;
  return sha256Digest(value);
}

export async function recordGenerationIntegrity(
  supabase: SupabaseServerClient,
  input: IntegrityInput
) {
  const { error } = await supabase.rpc('app_record_generation_integrity', {
    generation_run_id_input: input.generationRunId || null,
    event_type_input: input.eventType,
    source_hash_input: optionalHash(input.source),
    template_hash_input: optionalHash(input.template),
    rules_hash_input: optionalHash(input.rules),
    manifest_hash_input: optionalHash(input.manifest),
    output_hash_input: optionalHash(input.output),
    integrity_status_input: input.status || 'recorded',
    metadata_json_input: input.metadata || {}
  });

  // Integrity logging must never block generation.
  return error?.message || null;
}

export type GenerationIntegrityEvent = {
  id: string;
  generation_run_id: string | null;
  owner_id: string | null;
  event_type: string;
  source_hash: string | null;
  template_hash: string | null;
  rules_hash: string | null;
  manifest_hash: string | null;
  output_hash: string | null;
  integrity_status: string;
  created_at: string;
};

export async function listMasterGenerationIntegrityEvents(
  supabase: SupabaseServerClient,
  limit = 100
) {
  const { data, error } = await supabase.rpc('access_master_generation_integrity_events', {
    limit_count: limit
  });

  return {
    events: Array.isArray(data) ? data as GenerationIntegrityEvent[] : [],
    errorMessage: error?.message || null
  };
}
