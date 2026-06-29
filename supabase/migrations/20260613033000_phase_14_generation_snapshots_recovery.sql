-- Phase 14 — Generation Snapshot + Recovery Ledger
-- Safe to run multiple times.
-- Rules: no quota enforcement, no output limits, no generation blocking.

create extension if not exists pgcrypto;

create table if not exists public.generation_run_snapshots (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.generation_runs(id) on delete cascade,
  owner_id uuid null,
  source_hash text null,
  template_hash text null,
  rules_hash text null,
  manifest_hash text null,
  output_hash text null,
  integrity_status text not null default 'recorded',
  recovery_status text not null default 'closed',
  snapshot_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_error_events (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid null references public.generation_runs(id) on delete set null,
  owner_id uuid null,
  request_id text null,
  route_path text not null,
  event_type text not null default 'generation_error',
  safe_message text null,
  stack_hash text null,
  recovery_status text not null default 'open',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table public.generation_run_snapshots enable row level security;
alter table public.generation_error_events enable row level security;

create index if not exists generation_run_snapshots_run_idx
on public.generation_run_snapshots(generation_run_id, created_at desc);

create index if not exists generation_run_snapshots_owner_idx
on public.generation_run_snapshots(owner_id, created_at desc);

create index if not exists generation_run_snapshots_status_idx
on public.generation_run_snapshots(integrity_status, recovery_status, created_at desc);

create index if not exists generation_error_events_run_idx
on public.generation_error_events(generation_run_id, created_at desc);

create index if not exists generation_error_events_owner_idx
on public.generation_error_events(owner_id, created_at desc);

create index if not exists generation_error_events_status_idx
on public.generation_error_events(recovery_status, created_at desc);

create or replace function public.app_record_generation_run_snapshot(
  generation_run_id_input uuid,
  source_hash_input text default null,
  template_hash_input text default null,
  rules_hash_input text default null,
  manifest_hash_input text default null,
  output_hash_input text default null,
  integrity_status_input text default 'recorded',
  snapshot_json_input jsonb default '{}'::jsonb,
  metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_owner uuid;
  actor_profile public.profiles;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select gr.owner_id into run_owner
  from public.generation_runs gr
  where gr.id = generation_run_id_input;

  if run_owner is null then
    raise exception 'Generation run not found.';
  end if;

  select p.* into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if run_owner <> auth.uid() and coalesce(actor_profile.role::text, '') <> 'master' then
    raise exception 'Not allowed to snapshot this generation run.';
  end if;

  insert into public.generation_run_snapshots (
    generation_run_id,
    owner_id,
    source_hash,
    template_hash,
    rules_hash,
    manifest_hash,
    output_hash,
    integrity_status,
    recovery_status,
    snapshot_json,
    metadata_json
  ) values (
    generation_run_id_input,
    run_owner,
    source_hash_input,
    template_hash_input,
    rules_hash_input,
    manifest_hash_input,
    output_hash_input,
    coalesce(nullif(trim(integrity_status_input), ''), 'recorded'),
    case when coalesce(nullif(trim(integrity_status_input), ''), 'recorded') = 'failed' then 'open' else 'closed' end,
    coalesce(snapshot_json_input, '{}'::jsonb),
    coalesce(metadata_json_input, '{}'::jsonb)
  ) returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.app_record_generation_run_snapshot(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;

create or replace function public.app_record_generation_error_event(
  generation_run_id_input uuid default null,
  request_id_input text default null,
  route_path_input text default 'unknown',
  safe_message_input text default null,
  stack_hash_input text default null,
  metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_owner uuid;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if generation_run_id_input is not null then
    select gr.owner_id into run_owner
    from public.generation_runs gr
    where gr.id = generation_run_id_input;
  end if;

  insert into public.generation_error_events (
    generation_run_id,
    owner_id,
    request_id,
    route_path,
    event_type,
    safe_message,
    stack_hash,
    recovery_status,
    metadata_json
  ) values (
    generation_run_id_input,
    coalesce(run_owner, auth.uid()),
    nullif(trim(coalesce(request_id_input, '')), ''),
    coalesce(nullif(trim(route_path_input), ''), 'unknown'),
    'generation_error',
    safe_message_input,
    stack_hash_input,
    'open',
    coalesce(metadata_json_input, '{}'::jsonb)
  ) returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.app_record_generation_error_event(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

create or replace function public.access_master_generation_run_snapshots(
  limit_count integer default 100
)
returns table (
  id uuid,
  generation_run_id uuid,
  owner_id uuid,
  source_hash text,
  template_hash text,
  rules_hash text,
  manifest_hash text,
  output_hash text,
  integrity_status text,
  recovery_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select p.* into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.role <> 'master' then
    raise exception 'Only master can view generation snapshots.';
  end if;

  return query
  select
    s.id,
    s.generation_run_id,
    s.owner_id,
    s.source_hash,
    s.template_hash,
    s.rules_hash,
    s.manifest_hash,
    s.output_hash,
    s.integrity_status,
    s.recovery_status,
    s.created_at
  from public.generation_run_snapshots s
  order by s.created_at desc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
end;
$$;

grant execute on function public.access_master_generation_run_snapshots(integer) to authenticated;

create or replace function public.access_master_generation_error_events(
  limit_count integer default 100
)
returns table (
  id uuid,
  generation_run_id uuid,
  owner_id uuid,
  request_id text,
  route_path text,
  event_type text,
  safe_message text,
  stack_hash text,
  recovery_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select p.* into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.role <> 'master' then
    raise exception 'Only master can view generation error events.';
  end if;

  return query
  select
    e.id,
    e.generation_run_id,
    e.owner_id,
    e.request_id,
    e.route_path,
    e.event_type,
    e.safe_message,
    e.stack_hash,
    e.recovery_status,
    e.created_at
  from public.generation_error_events e
  order by e.created_at desc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
end;
$$;

grant execute on function public.access_master_generation_error_events(integer) to authenticated;

analyze public.generation_run_snapshots;
analyze public.generation_error_events;
analyze public.generation_runs;

notify pgrst, 'reload schema';
