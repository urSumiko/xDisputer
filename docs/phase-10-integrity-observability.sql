-- Phase 10A/10C — Generation Integrity + Observability Foundation
-- Run this in Supabase SQL Editor before verifying /master/system.
-- Rules: no quota enforcement, no output limits, no generation blocking.

create table if not exists public.generation_integrity_events (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid null,
  owner_id uuid null,
  event_type text not null,
  source_hash text null,
  template_hash text null,
  rules_hash text null,
  manifest_hash text null,
  output_hash text null,
  integrity_status text not null default 'recorded',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  request_id text null,
  actor_id uuid null,
  actor_email text null,
  actor_role text null,
  route_path text not null,
  event_type text not null,
  event_status text not null default 'info',
  duration_ms integer null,
  safe_message text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generation_integrity_run_idx
on public.generation_integrity_events(generation_run_id, created_at desc);

create index if not exists generation_integrity_owner_idx
on public.generation_integrity_events(owner_id, created_at desc);

create index if not exists generation_integrity_status_idx
on public.generation_integrity_events(integrity_status, created_at desc);

create index if not exists system_events_created_idx
on public.system_events(created_at desc);

create index if not exists system_events_actor_idx
on public.system_events(actor_id, created_at desc);

create index if not exists system_events_route_idx
on public.system_events(route_path, created_at desc);

create index if not exists system_events_status_idx
on public.system_events(event_status, created_at desc);

create or replace function public.app_log_system_event(
  request_id_input text,
  route_path_input text,
  event_type_input text,
  event_status_input text default 'info',
  duration_ms_input integer default null,
  safe_message_input text default null,
  metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
  new_id uuid;
begin
  if auth.uid() is not null then
    select p.* into actor_profile
    from public.profiles p
    where p.id = auth.uid();
  end if;

  insert into public.system_events (
    request_id,
    actor_id,
    actor_email,
    actor_role,
    route_path,
    event_type,
    event_status,
    duration_ms,
    safe_message,
    metadata_json
  )
  values (
    nullif(trim(coalesce(request_id_input, '')), ''),
    auth.uid(),
    actor_profile.email,
    actor_profile.role::text,
    coalesce(nullif(trim(route_path_input), ''), 'unknown'),
    coalesce(nullif(trim(event_type_input), ''), 'event'),
    coalesce(nullif(trim(event_status_input), ''), 'info'),
    duration_ms_input,
    safe_message_input,
    coalesce(metadata_json_input, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.app_log_system_event(
  text,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) to authenticated;

create or replace function public.app_record_generation_integrity(
  generation_run_id_input uuid,
  event_type_input text,
  source_hash_input text default null,
  template_hash_input text default null,
  rules_hash_input text default null,
  manifest_hash_input text default null,
  output_hash_input text default null,
  integrity_status_input text default 'recorded',
  metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.generation_integrity_events (
    generation_run_id,
    owner_id,
    event_type,
    source_hash,
    template_hash,
    rules_hash,
    manifest_hash,
    output_hash,
    integrity_status,
    metadata_json
  )
  values (
    generation_run_id_input,
    auth.uid(),
    coalesce(nullif(trim(event_type_input), ''), 'generation_event'),
    source_hash_input,
    template_hash_input,
    rules_hash_input,
    manifest_hash_input,
    output_hash_input,
    coalesce(nullif(trim(integrity_status_input), ''), 'recorded'),
    coalesce(metadata_json_input, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.app_record_generation_integrity(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

create or replace function public.access_master_system_events(
  limit_count integer default 100
)
returns table (
  id uuid,
  request_id text,
  actor_email text,
  actor_role text,
  route_path text,
  event_type text,
  event_status text,
  duration_ms integer,
  safe_message text,
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
    raise exception 'Only master can view system events.';
  end if;

  return query
  select
    e.id,
    e.request_id,
    e.actor_email,
    e.actor_role,
    e.route_path,
    e.event_type,
    e.event_status,
    e.duration_ms,
    e.safe_message,
    e.created_at
  from public.system_events e
  order by e.created_at desc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
end;
$$;

grant execute on function public.access_master_system_events(integer) to authenticated;

create or replace function public.access_master_generation_integrity_events(
  limit_count integer default 100
)
returns table (
  id uuid,
  generation_run_id uuid,
  owner_id uuid,
  event_type text,
  source_hash text,
  template_hash text,
  rules_hash text,
  manifest_hash text,
  output_hash text,
  integrity_status text,
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
    raise exception 'Only master can view generation integrity events.';
  end if;

  return query
  select
    e.id,
    e.generation_run_id,
    e.owner_id,
    e.event_type,
    e.source_hash,
    e.template_hash,
    e.rules_hash,
    e.manifest_hash,
    e.output_hash,
    e.integrity_status,
    e.created_at
  from public.generation_integrity_events e
  order by e.created_at desc
  limit greatest(1, least(coalesce(limit_count, 100), 500));
end;
$$;

grant execute on function public.access_master_generation_integrity_events(integer) to authenticated;

notify pgrst, 'reload schema';
