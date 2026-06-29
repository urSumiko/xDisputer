-- AI Backend Architecture Foundation
-- Run in Supabase SQL editor or through Supabase migrations.

create extension if not exists pgcrypto;

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text null,
  model_name text null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  request_id uuid null references public.ai_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text null,
  latency_ms integer null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null default 'manual',
  source_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  error_message text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists ai_requests_owner_created_idx on public.ai_requests(owner_id, created_at desc);
create index if not exists ai_tool_calls_request_created_idx on public.ai_tool_calls(request_id, created_at asc);
create index if not exists ai_documents_owner_created_idx on public.ai_documents(owner_id, created_at desc);
create index if not exists ai_chunks_document_index_idx on public.ai_chunks(document_id, chunk_index);
create index if not exists ai_jobs_status_run_after_idx on public.ai_jobs(status, run_after asc);

notify pgrst, 'reload schema';
