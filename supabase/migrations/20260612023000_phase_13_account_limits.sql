-- Phase 13 — Master-controlled account limits
-- Purpose:
--   - Let master set manager client capacity.
--   - Let master set per-client successful output capacity.
--   - Enforce both limits in Supabase, not only in UI.
--
-- Safety:
--   - Additive table, functions, and triggers.
--   - No destructive data changes.
--   - Existing accounts receive safe defaults.

create extension if not exists pgcrypto;

create table if not exists public.account_limit_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  manager_client_limit integer,
  client_output_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint account_limit_settings_manager_limit_check check (manager_client_limit is null or manager_client_limit >= 0),
  constraint account_limit_settings_output_limit_check check (client_output_limit is null or client_output_limit >= 0)
);

alter table public.account_limit_settings enable row level security;

create index if not exists idx_account_limit_settings_updated
  on public.account_limit_settings(updated_at desc);

create or replace function public.access_default_manager_client_limit()
returns integer
language sql
stable
as $$
  select 10;
$$;

create or replace function public.access_default_client_output_limit()
returns integer
language sql
stable
as $$
  select 25;
$$;

create or replace function public.access_manager_active_client_count(manager_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles c
  where c.role::text = 'client'
    and c.manager_id = manager_id_input
    and c.account_status::text = 'active';
$$;

create or replace function public.access_client_successful_output_count(client_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.generation_runs gr
  where gr.owner_id = client_id_input
    and coalesce(gr.output_status, 'generated') in ('generated', 'downloaded');
$$;

create or replace function public.access_effective_manager_client_limit(manager_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select manager_client_limit from public.account_limit_settings where profile_id = manager_id_input),
    public.access_default_manager_client_limit()
  );
$$;

create or replace function public.access_effective_client_output_limit(client_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select client_output_limit from public.account_limit_settings where profile_id = client_id_input),
    public.access_default_client_output_limit()
  );
$$;

create or replace function public.access_account_limit_snapshot_v1(profile_ids uuid[] default null)
returns table (
  profile_id uuid,
  role text,
  manager_client_limit integer,
  manager_active_clients integer,
  manager_client_remaining integer,
  client_output_limit integer,
  client_successful_outputs integer,
  client_output_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select p.role::text
  into actor_role_value
  from public.profiles p
  where p.id = auth.uid();

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Only master or manager accounts can view account limit snapshots.';
  end if;

  return query
  select
    p.id as profile_id,
    case when p.role::text = 'admin' then 'manager' else p.role::text end as role,
    public.access_effective_manager_client_limit(p.id) as manager_client_limit,
    public.access_manager_active_client_count(p.id) as manager_active_clients,
    greatest(public.access_effective_manager_client_limit(p.id) - public.access_manager_active_client_count(p.id), 0) as manager_client_remaining,
    public.access_effective_client_output_limit(p.id) as client_output_limit,
    public.access_client_successful_output_count(p.id) as client_successful_outputs,
    greatest(public.access_effective_client_output_limit(p.id) - public.access_client_successful_output_count(p.id), 0) as client_output_remaining
  from public.profiles p
  where (profile_ids is null or p.id = any(profile_ids))
    and (
      actor_role_value = 'master'
      or p.id = auth.uid()
      or p.manager_id = auth.uid()
      or exists (
        select 1
        from public.client_manager_assignments ca
        where ca.client_id = p.id
          and ca.manager_id = auth.uid()
          and ca.assignment_status in ('pending', 'active')
      )
    );
end;
$$;

grant execute on function public.access_account_limit_snapshot_v1(uuid[]) to authenticated;

create or replace function public.access_master_set_account_limits_v1(
  target_profile_id uuid,
  manager_client_limit_input integer default null,
  client_output_limit_input integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
  target_role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select role::text into actor_role_value from public.profiles where id = auth.uid();
  if actor_role_value <> 'master' then
    raise exception 'Only master can update account limits.';
  end if;

  select role::text into target_role_value from public.profiles where id = target_profile_id;
  if target_role_value is null then
    raise exception 'Target profile not found.';
  end if;

  if manager_client_limit_input is not null and manager_client_limit_input < 0 then
    raise exception 'Manager client limit cannot be negative.';
  end if;

  if client_output_limit_input is not null and client_output_limit_input < 0 then
    raise exception 'Client output limit cannot be negative.';
  end if;

  insert into public.account_limit_settings (
    profile_id,
    manager_client_limit,
    client_output_limit,
    updated_by,
    updated_at
  ) values (
    target_profile_id,
    manager_client_limit_input,
    client_output_limit_input,
    auth.uid(),
    now()
  )
  on conflict (profile_id) do update
  set manager_client_limit = coalesce(manager_client_limit_input, public.account_limit_settings.manager_client_limit),
      client_output_limit = coalesce(client_output_limit_input, public.account_limit_settings.client_output_limit),
      updated_by = auth.uid(),
      updated_at = now();

  return true;
end;
$$;

grant execute on function public.access_master_set_account_limits_v1(uuid, integer, integer) to authenticated;

create or replace function public.access_enforce_manager_client_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_value integer;
  active_count integer;
begin
  if new.role::text <> 'client' then
    return new;
  end if;

  if new.manager_id is null or new.account_status::text <> 'active' then
    return new;
  end if;

  limit_value := public.access_effective_manager_client_limit(new.manager_id);

  select count(*)::integer
  into active_count
  from public.profiles c
  where c.role::text = 'client'
    and c.manager_id = new.manager_id
    and c.account_status::text = 'active'
    and c.id <> new.id;

  if active_count >= limit_value then
    raise exception 'Manager client limit reached. This manager has % active clients out of % allowed.', active_count, limit_value;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_access_enforce_manager_client_limit on public.profiles;
create trigger trg_access_enforce_manager_client_limit
before insert or update of manager_id, account_status, role on public.profiles
for each row
execute function public.access_enforce_manager_client_limit();

create or replace function public.access_enforce_client_output_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_value integer;
  output_count integer;
begin
  if new.owner_id is null then
    return new;
  end if;

  if coalesce(new.output_status, 'generated') not in ('generated', 'downloaded') then
    return new;
  end if;

  limit_value := public.access_effective_client_output_limit(new.owner_id);

  select count(*)::integer
  into output_count
  from public.generation_runs gr
  where gr.owner_id = new.owner_id
    and coalesce(gr.output_status, 'generated') in ('generated', 'downloaded');

  if output_count >= limit_value then
    raise exception 'Client output limit reached. This client has % successful outputs out of % allowed.', output_count, limit_value;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_access_enforce_client_output_limit on public.generation_runs;
create trigger trg_access_enforce_client_output_limit
before insert on public.generation_runs
for each row
execute function public.access_enforce_client_output_limit();

notify pgrst, 'reload schema';
