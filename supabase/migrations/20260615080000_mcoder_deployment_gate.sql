begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.deployment_requests (
  id uuid primary key default gen_random_uuid(),
  group_key text not null default 'default',
  commit_sha text not null,
  ref_name text not null,
  environment text not null,
  status text not null default 'pending',
  requested_by_email text not null,
  requested_at timestamptz not null default timezone('utc'::text, now()),
  reviewed_at timestamptz,
  reviewed_by_email text,
  review_comment text,
  consumed_at timestamptz,
  workflow_run_id bigint,
  workflow_url text,
  summary jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (timezone('utc'::text, now()) + interval '7 days'),
  constraint deployment_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled', 'consumed', 'expired')),
  constraint deployment_requests_environment_check check (environment in ('preview', 'staging', 'production')),
  constraint deployment_requests_commit_sha_check check (commit_sha ~ '^[0-9a-f]{7,40}$')
);

create index if not exists deployment_requests_status_requested_at_idx on public.deployment_requests (status, requested_at desc);
create index if not exists deployment_requests_commit_environment_idx on public.deployment_requests (commit_sha, environment, status);
create index if not exists deployment_requests_group_environment_idx on public.deployment_requests (group_key, environment, requested_at desc);

alter table public.deployment_requests enable row level security;

drop policy if exists deployment_requests_service_role_all on public.deployment_requests;
create policy deployment_requests_service_role_all
on public.deployment_requests
for all
to service_role
using (true)
with check (true);

create or replace function public.request_deployment_approval_service(
  p_group_key text,
  p_commit_sha text,
  p_ref_name text,
  p_environment text,
  p_requested_by_email text,
  p_summary jsonb default '{}'::jsonb
)
returns public.deployment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.deployment_requests;
  v_row public.deployment_requests;
  v_group_key text := coalesce(nullif(trim(p_group_key), ''), 'default');
  v_commit_sha text := lower(trim(p_commit_sha));
  v_environment text := lower(trim(p_environment));
begin
  if v_commit_sha !~ '^[0-9a-f]{7,40}$' then
    raise exception 'Invalid commit sha: %', p_commit_sha;
  end if;

  if v_environment not in ('preview', 'staging', 'production') then
    raise exception 'Unsupported deployment environment: %', p_environment;
  end if;

  select *
  into v_existing
  from public.deployment_requests
  where group_key = v_group_key
    and commit_sha = v_commit_sha
    and environment = v_environment
    and status in ('pending', 'approved')
  order by requested_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.deployment_requests (
    group_key,
    commit_sha,
    ref_name,
    environment,
    requested_by_email,
    summary
  ) values (
    v_group_key,
    v_commit_sha,
    trim(p_ref_name),
    v_environment,
    lower(trim(p_requested_by_email)),
    coalesce(p_summary, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.review_deployment_approval_service(
  p_request_id uuid,
  p_decision text,
  p_reviewed_by_email text,
  p_comment text default null
)
returns public.deployment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.deployment_requests;
  v_decision text := lower(trim(p_decision));
begin
  if v_decision not in ('approved', 'rejected', 'cancelled') then
    raise exception 'Unsupported decision: %', p_decision;
  end if;

  select *
  into v_row
  from public.deployment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Deployment request not found: %', p_request_id;
  end if;

  if v_row.status in ('consumed', 'expired') then
    raise exception 'Deployment request % is already terminal with status %', p_request_id, v_row.status;
  end if;

  update public.deployment_requests
  set status = v_decision,
      reviewed_at = timezone('utc'::text, now()),
      reviewed_by_email = lower(trim(p_reviewed_by_email)),
      review_comment = nullif(trim(coalesce(p_comment, '')), '')
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.assert_deployment_approval_service(
  p_request_id uuid,
  p_commit_sha text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.deployment_requests;
begin
  select *
  into v_row
  from public.deployment_requests
  where id = p_request_id;

  if not found then
    return jsonb_build_object('approved', false, 'reason', 'request_not_found');
  end if;

  if v_row.commit_sha <> lower(trim(p_commit_sha)) then
    return jsonb_build_object('approved', false, 'reason', 'sha_mismatch', 'expected', v_row.commit_sha);
  end if;

  if v_row.environment <> lower(trim(p_environment)) then
    return jsonb_build_object('approved', false, 'reason', 'environment_mismatch', 'expected', v_row.environment);
  end if;

  if v_row.expires_at < timezone('utc'::text, now()) then
    update public.deployment_requests
    set status = 'expired'
    where id = v_row.id and status = 'approved';

    return jsonb_build_object('approved', false, 'reason', 'expired');
  end if;

  if v_row.status <> 'approved' then
    return jsonb_build_object('approved', false, 'reason', v_row.status);
  end if;

  return jsonb_build_object(
    'approved', true,
    'request_id', v_row.id,
    'group_key', v_row.group_key,
    'commit_sha', v_row.commit_sha,
    'environment', v_row.environment,
    'reviewed_by_email', v_row.reviewed_by_email
  );
end;
$$;

create or replace function public.consume_deployment_approval_service(
  p_request_id uuid,
  p_commit_sha text,
  p_environment text,
  p_workflow_run_id bigint,
  p_workflow_url text
)
returns public.deployment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check jsonb;
  v_row public.deployment_requests;
begin
  v_check := public.assert_deployment_approval_service(p_request_id, p_commit_sha, p_environment);

  if coalesce((v_check ->> 'approved')::boolean, false) = false then
    raise exception 'Deployment approval check failed: %', v_check ->> 'reason';
  end if;

  update public.deployment_requests
  set status = 'consumed',
      consumed_at = timezone('utc'::text, now()),
      workflow_run_id = p_workflow_run_id,
      workflow_url = nullif(trim(coalesce(p_workflow_url, '')), '')
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.request_deployment_approval_service(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.review_deployment_approval_service(uuid, text, text, text) to service_role;
grant execute on function public.assert_deployment_approval_service(uuid, text, text) to service_role;
grant execute on function public.consume_deployment_approval_service(uuid, text, text, bigint, text) to service_role;

notify pgrst, 'reload schema';

commit;
