begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.deployment_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.deployment_requests(id) on delete cascade,
  event_type text not null check (
    event_type in ('requested', 'approved', 'rejected', 'cancelled', 'consumed', 'expired', 'commented')
  ),
  actor_email text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists deployment_request_events_request_created_idx
  on public.deployment_request_events (request_id, created_at desc);

create unique index if not exists deployment_requests_one_open_request_per_group_sha_env_idx
  on public.deployment_requests (group_key, commit_sha, environment)
  where status in ('pending', 'approved');

alter table public.deployment_request_events enable row level security;

drop policy if exists deployment_request_events_service_role_all on public.deployment_request_events;
create policy deployment_request_events_service_role_all
on public.deployment_request_events
for all
to service_role
using (true)
with check (true);

create or replace function public.append_deployment_request_event_service(
  p_request_id uuid,
  p_event_type text,
  p_actor_email text default null,
  p_comment text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.deployment_request_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.deployment_request_events;
begin
  insert into public.deployment_request_events (
    request_id,
    event_type,
    actor_email,
    comment,
    metadata
  ) values (
    p_request_id,
    lower(trim(p_event_type)),
    nullif(lower(trim(coalesce(p_actor_email, ''))), ''),
    nullif(trim(coalesce(p_comment, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.list_deployment_requests_service(
  p_status text default null,
  p_group_key text default null,
  p_environment text default null
)
returns table (
  id uuid,
  group_key text,
  environment text,
  commit_sha text,
  ref_name text,
  status text,
  requested_by_email text,
  requested_at timestamptz,
  reviewed_by_email text,
  reviewed_at timestamptz,
  review_comment text,
  consumed_at timestamptz,
  workflow_run_id bigint,
  workflow_url text
)
language sql
security definer
set search_path = ''
as $$
  select
    r.id,
    r.group_key,
    r.environment,
    r.commit_sha,
    r.ref_name,
    r.status,
    r.requested_by_email,
    r.requested_at,
    r.reviewed_by_email,
    r.reviewed_at,
    r.review_comment,
    r.consumed_at,
    r.workflow_run_id,
    r.workflow_url
  from public.deployment_requests r
  where (p_status is null or r.status = lower(trim(p_status)))
    and (p_group_key is null or r.group_key = trim(p_group_key))
    and (p_environment is null or r.environment = lower(trim(p_environment)))
  order by r.environment asc, r.group_key asc, r.requested_at desc;
$$;

grant execute on function public.append_deployment_request_event_service(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.list_deployment_requests_service(text, text, text) to service_role;

insert into public.deployment_request_events (
  request_id,
  event_type,
  actor_email,
  metadata,
  created_at
)
select
  r.id,
  'requested',
  r.requested_by_email,
  coalesce(r.summary, '{}'::jsonb),
  r.requested_at
from public.deployment_requests r
where not exists (
  select 1
  from public.deployment_request_events e
  where e.request_id = r.id
);

notify pgrst, 'reload schema';

commit;
