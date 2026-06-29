import type { createSupabaseServerClient } from '../supabase/server';
import { sha256Digest, stableStringify } from './integrity-ledger';
import { safeErrorMessage } from './system-observability';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SnapshotStatus = 'recorded' | 'validated' | 'failed' | 'recovered';

export type GenerationRunSnapshotInput = {
  generationRunId: string;
  source?: unknown;
  template?: unknown;
  rules?: unknown;
  manifest?: unknown;
  output?: unknown;
  status?: SnapshotStatus;
  metadata?: Record<string, unknown>;
};

export type GenerationErrorEventInput = {
  generationRunId?: string | null;
  requestId?: string | null;
  routePath: string;
  error: unknown;
  metadata?: Record<string, unknown>;
};

export type GenerationRunSnapshot = {
  id: string;
  generation_run_id: string;
  owner_id: string | null;
  source_hash: string | null;
  template_hash: string | null;
  rules_hash: string | null;
  manifest_hash: string | null;
  output_hash: string | null;
  integrity_status: string;
  recovery_status: string;
  created_at: string;
};

export type GenerationErrorEvent = {
  id: string;
  generation_run_id: string | null;
  owner_id: string | null;
  request_id: string | null;
  route_path: string;
  event_type: string;
  safe_message: string | null;
  stack_hash: string | null;
  recovery_status: string;
  created_at: string;
};

function optionalHash(value: unknown) {
  if (typeof value === 'undefined' || value === null) return null;
  return sha256Digest(value);
}

function snapshotSummary(value: unknown): unknown {
  if (typeof value === 'undefined' || value === null) return null;

  if (typeof value === 'string') {
    return {
      kind: 'text',
      byteLength: new TextEncoder().encode(value).length,
      lineCount: value.split(/\r?\n/).length,
      hash: sha256Digest(value)
    };
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      hash: sha256Digest(value)
    };
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return {
      kind: 'object',
      keys: Object.keys(objectValue).sort().slice(0, 80),
      hash: sha256Digest(objectValue),
      value: objectValue
    };
  }

  return {
    kind: typeof value,
    value,
    hash: sha256Digest(value)
  };
}

function compactSnapshot(input: GenerationRunSnapshotInput) {
  return {
    source: snapshotSummary(input.source),
    template: snapshotSummary(input.template),
    rules: snapshotSummary(input.rules),
    manifest: snapshotSummary(input.manifest),
    output: snapshotSummary(input.output),
    metadata: input.metadata || {}
  };
}

function stackDigest(error: unknown) {
  if (error instanceof Error && error.stack) return sha256Digest(error.stack);
  return error instanceof Error ? sha256Digest(error.message) : sha256Digest(stableStringify(error));
}

export async function recordGenerationRunSnapshot(
  supabase: SupabaseServerClient,
  input: GenerationRunSnapshotInput
) {
  const { error } = await supabase.rpc('app_record_generation_run_snapshot', {
    generation_run_id_input: input.generationRunId,
    source_hash_input: optionalHash(input.source),
    template_hash_input: optionalHash(input.template),
    rules_hash_input: optionalHash(input.rules),
    manifest_hash_input: optionalHash(input.manifest),
    output_hash_input: optionalHash(input.output),
    integrity_status_input: input.status || 'recorded',
    snapshot_json_input: compactSnapshot(input),
    metadata_json_input: input.metadata || {}
  });

  // Snapshot persistence must never block generation or download.
  return error?.message || null;
}

export async function recordGenerationErrorEvent(
  supabase: SupabaseServerClient,
  input: GenerationErrorEventInput
) {
  const { error } = await supabase.rpc('app_record_generation_error_event', {
    generation_run_id_input: input.generationRunId || null,
    request_id_input: input.requestId || null,
    route_path_input: input.routePath,
    safe_message_input: safeErrorMessage(input.error),
    stack_hash_input: stackDigest(input.error),
    metadata_json_input: input.metadata || {}
  });

  // Recovery logging must never block the request that is already handling an error.
  return error?.message || null;
}

export async function listMasterGenerationRunSnapshots(
  supabase: SupabaseServerClient,
  limit = 100
) {
  const { data, error } = await supabase.rpc('access_master_generation_run_snapshots', {
    limit_count: limit
  });

  return {
    snapshots: Array.isArray(data) ? data as GenerationRunSnapshot[] : [],
    errorMessage: error?.message || null
  };
}

export async function listMasterGenerationErrorEvents(
  supabase: SupabaseServerClient,
  limit = 100
) {
  const { data, error } = await supabase.rpc('access_master_generation_error_events', {
    limit_count: limit
  });

  return {
    events: Array.isArray(data) ? data as GenerationErrorEvent[] : [],
    errorMessage: error?.message || null
  };
}
