-- Phase 11E RPC cache repair
-- Fixes UI errors such as:
--   Could not find the function public.access_workspace_account_summary_v1(workspace_id_input) in the schema cache
--
-- Safe:
--   - Recreates only Phase 11E read RPCs.
--   - Does not delete tables or account data.
--   - Does not affect generated output.

create extension if not exists pgcrypto;

drop function if exists public.access_workspace_account_summary_v1(uuid);
drop function if exists public.access_workspace_account_directory_v1(uuid, text, text, integer, integer);

create or replace function public.access_workspace_account_summary_v1(
  workspace_id_input uuid default null
)
returns table (
  workspace_id uuid,
  total_users bigint,
  pending_clients bigint,
  active_clients bigint,
  blocked_accounts bigint,
  manager_accounts bigint,
  client_accounts bigint,
  linked_clients bigint,
  unassigned_clients bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  perform public.access_ensure_default_workspace_membership(auth.uid());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Not allowed to view workspace account summary.';
  end if;

  return query
  with visible as (
    select
      p.id,
      p.role::text as platform_role,
      p.account_status::text as account_status,
      wm.member_role,
      coalesce(ca.manager_id, p.manager_id) as manager_id,
      ca.assignment_status
    from public.workspace_members wm
    join public.profiles p on p.id = wm.profile_id
    left join public.client_manager_assignments ca
      on ca.workspace_id = wm.workspace_id
      and ca.client_id = p.id
      and ca.assignment_role = 'primary'
      and ca.assignment_status in ('pending', 'active')
    where wm.workspace_id = workspace_id_value
      and (
        actor_role_value = 'master'
        or (
          actor_role_value = 'manager'
          and (
            wm.profile_id = auth.uid()
            or ca.manager_id = auth.uid()
            or p.manager_id = auth.uid()
          )
        )
      )
  )
  select
    workspace_id_value,
    count(*)::bigint,
    count(*) filter (
      where member_role = 'client'
        and (account_status like 'pending%' or assignment_status = 'pending')
    )::bigint,
    count(*) filter (
      where member_role = 'client'
        and account_status = 'active'
        and coalesce(assignment_status, 'active') = 'active'
    )::bigint,
    count(*) filter (
      where account_status in ('disabled', 'suspended')
    )::bigint,
    count(*) filter (where member_role = 'manager')::bigint,
    count(*) filter (where member_role = 'client')::bigint,
    count(*) filter (where member_role = 'client' and manager_id is not null)::bigint,
    count(*) filter (where member_role = 'client' and manager_id is null)::bigint
  from visible;
end;
$$;

grant execute on function public.access_workspace_account_summary_v1(uuid) to authenticated;

create or replace function public.access_workspace_account_directory_v1(
  workspace_id_input uuid default null,
  view_input text default 'all',
  search_input text default null,
  page_input integer default 1,
  page_size_input integer default 25
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  account_status text,
  manager_id uuid,
  manager_invite_code text,
  created_at timestamptz,
  updated_at timestamptz,
  workspace_id uuid,
  workspace_role text,
  membership_status text,
  assignment_status text,
  primary_manager_email text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  safe_page integer;
  safe_size integer;
  offset_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  perform public.access_ensure_default_workspace_membership(auth.uid());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Not allowed to view workspace account directory.';
  end if;

  safe_page := greatest(1, coalesce(page_input, 1));
  safe_size := greatest(1, least(coalesce(page_size_input, 25), 100));
  offset_count := (safe_page - 1) * safe_size;

  return query
  with base as (
    select
      p.id,
      p.email,
      p.full_name,
      case when p.role::text = 'admin' then 'manager' else p.role::text end as role,
      p.account_status::text as account_status,
      coalesce(ca.manager_id, p.manager_id) as manager_id,
      p.manager_invite_code,
      p.created_at,
      p.updated_at,
      wm.workspace_id,
      wm.member_role as workspace_role,
      wm.membership_status,
      ca.assignment_status,
      pm.email as primary_manager_email
    from public.workspace_members wm
    join public.profiles p on p.id = wm.profile_id
    left join public.client_manager_assignments ca
      on ca.workspace_id = wm.workspace_id
      and ca.client_id = p.id
      and ca.assignment_role = 'primary'
      and ca.assignment_status in ('pending', 'active')
    left join public.profiles pm on pm.id = coalesce(ca.manager_id, p.manager_id)
    where wm.workspace_id = workspace_id_value
      and (
        actor_role_value = 'master'
        or (
          actor_role_value = 'manager'
          and (
            wm.profile_id = auth.uid()
            or ca.manager_id = auth.uid()
            or p.manager_id = auth.uid()
          )
        )
      )
      and (
        coalesce(view_input, 'all') = 'all'
        or (view_input = 'managers' and wm.member_role = 'manager')
        or (view_input = 'clients' and wm.member_role = 'client')
        or (view_input = 'pending' and wm.member_role = 'client' and (p.account_status::text like 'pending%' or ca.assignment_status = 'pending'))
        or (view_input = 'active' and wm.member_role = 'client' and p.account_status::text = 'active' and coalesce(ca.assignment_status, 'active') = 'active')
        or (view_input = 'blocked' and p.account_status::text in ('disabled', 'suspended'))
      )
      and (
        nullif(trim(coalesce(search_input, '')), '') is null
        or p.email ilike '%' || trim(search_input) || '%'
        or p.full_name ilike '%' || trim(search_input) || '%'
        or p.id::text ilike '%' || trim(search_input) || '%'
        or p.role::text ilike '%' || trim(search_input) || '%'
        or p.account_status::text ilike '%' || trim(search_input) || '%'
        or p.manager_invite_code ilike '%' || trim(search_input) || '%'
        or pm.email ilike '%' || trim(search_input) || '%'
      )
  ), counted as (
    select base.*, count(*) over() as total_count
    from base
  )
  select
    counted.id,
    counted.email,
    counted.full_name,
    counted.role,
    counted.account_status,
    counted.manager_id,
    counted.manager_invite_code,
    counted.created_at,
    counted.updated_at,
    counted.workspace_id,
    counted.workspace_role,
    counted.membership_status,
    counted.assignment_status,
    counted.primary_manager_email,
    counted.total_count
  from counted
  order by counted.created_at desc
  limit safe_size offset offset_count;
end;
$$;

grant execute on function public.access_workspace_account_directory_v1(uuid, text, text, integer, integer) to authenticated;

select public.access_11d_migrate_profile_manager_assignments();

notify pgrst, 'reload schema';
