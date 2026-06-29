-- Phase 12 — Instant reload Supabase performance layer
-- Purpose:
--   - Add safe indexes for workspace-scoped dashboards, directories, controls, and template reads.
--   - Add compact attention queue RPC for dashboard snapshots.
--   - Preserve Phase 11D/11E controls and generated document behavior.
--
-- Safety:
--   - Additive indexes only.
--   - Additive RPC with *_v1 name.
--   - No quota enforcement.
--   - No destructive table changes.
--   - No generated-output changes.

create extension if not exists pgcrypto;

-- ============================================================
-- Indexes for workspace/account access paths
-- ============================================================

create index if not exists idx_workspace_members_workspace_role_status_profile
  on public.workspace_members (workspace_id, member_role, membership_status, profile_id);

create index if not exists idx_workspace_members_profile_workspace
  on public.workspace_members (profile_id, workspace_id);

create index if not exists idx_client_manager_assignments_primary_client_active
  on public.client_manager_assignments (workspace_id, client_id, manager_id, assignment_status, created_at desc)
  where assignment_role = 'primary'
    and assignment_status in ('pending', 'active');

create index if not exists idx_client_manager_assignments_primary_manager_active
  on public.client_manager_assignments (workspace_id, manager_id, assignment_status, client_id, created_at desc)
  where assignment_role = 'primary'
    and assignment_status in ('pending', 'active');

create index if not exists idx_profiles_role_status_updated
  on public.profiles (role, account_status, updated_at desc);

create index if not exists idx_profiles_manager_status_updated
  on public.profiles (manager_id, account_status, updated_at desc)
  where manager_id is not null;

create index if not exists idx_template_assets_owner_round_active_slot
  on public.template_assets (
    owner_id,
    round_label,
    is_active,
    template_kind,
    letter_type,
    exhibit_kind,
    version_number desc,
    updated_at desc
  );

create index if not exists idx_generation_runs_owner_created
  on public.generation_runs (owner_id, created_at desc);

-- ============================================================
-- Compact dashboard attention queue
-- ============================================================

create or replace function public.access_workspace_attention_queue_v1(
  workspace_id_input uuid default null,
  limit_input integer default 5
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
  safe_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  safe_limit := greatest(1, least(coalesce(limit_input, 5), 25));

  perform public.access_ensure_default_workspace_membership(auth.uid());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Not allowed to view workspace attention queue.';
  end if;

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
      pm.email as primary_manager_email,
      case
        when p.account_status::text in ('disabled', 'suspended') then 1
        when wm.member_role = 'client' and (p.account_status::text like 'pending%' or ca.assignment_status = 'pending') then 2
        else 9
      end as attention_priority
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
        p.account_status::text in ('disabled', 'suspended')
        or (
          wm.member_role = 'client'
          and (p.account_status::text like 'pending%' or ca.assignment_status = 'pending')
        )
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
  order by counted.attention_priority asc, counted.updated_at desc, counted.created_at desc
  limit safe_limit;
end;
$$;

grant execute on function public.access_workspace_attention_queue_v1(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
