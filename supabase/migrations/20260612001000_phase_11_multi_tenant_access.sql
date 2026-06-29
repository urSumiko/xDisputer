-- Phase 11A/11B/11C — Multi-Tenant Access Foundation
-- Safe additive migration.
-- Goals:
--   11A: workspace + membership tables
--   11B: central access policy RPCs
--   11C: client assignment ledger
-- Rules:
--   - No quota enforcement.
--   - No generation output limits.
--   - No destructive migration of current profiles.manager_id.
--   - Existing manager/client flows continue to work while the new framework is introduced.

create extension if not exists pgcrypto;

-- ============================================================
-- 11A. Workspace / tenant foundation
-- ============================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'archived')),
  owner_id uuid null references public.profiles(id) on delete set null,
  created_by uuid null references public.profiles(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workspace_role text not null check (workspace_role in ('owner', 'master', 'manager', 'client', 'viewer')),
  membership_status text not null default 'active' check (membership_status in ('pending', 'active', 'suspended', 'disabled', 'removed')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_code text not null unique,
  invited_role text not null check (invited_role in ('master', 'manager', 'client', 'viewer')),
  invited_email text null,
  created_by uuid null references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  max_uses integer null check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists default_workspace_id uuid null references public.workspaces(id) on delete set null;

create index if not exists workspaces_status_idx
on public.workspaces(status, created_at desc);

create index if not exists workspace_members_profile_idx
on public.workspace_members(profile_id, membership_status);

create index if not exists workspace_members_workspace_role_idx
on public.workspace_members(workspace_id, workspace_role, membership_status);

create index if not exists workspace_invites_workspace_idx
on public.workspace_invites(workspace_id, status, created_at desc);

create index if not exists profiles_default_workspace_idx
on public.profiles(default_workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- ============================================================
-- 11C. Client assignment ledger
-- ============================================================

create table if not exists public.client_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'primary' check (assignment_role in ('primary', 'reviewer', 'assistant')),
  assignment_status text not null default 'pending' check (assignment_status in ('pending', 'active', 'revoked', 'transferred')),
  assigned_by uuid null references public.profiles(id) on delete set null,
  approved_by uuid null references public.profiles(id) on delete set null,
  revoked_by uuid null references public.profiles(id) on delete set null,
  source text not null default 'manual',
  reason text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  revoked_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_assignment_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid null references public.client_manager_assignments(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid null references public.profiles(id) on delete set null,
  actor_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  event_status text not null default 'recorded' check (event_status in ('recorded', 'pending', 'active', 'revoked', 'transferred', 'failed')),
  reason text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists client_manager_active_primary_unique_idx
on public.client_manager_assignments(workspace_id, client_id)
where assignment_role = 'primary' and assignment_status = 'active';

create unique index if not exists client_manager_backfill_unique_idx
on public.client_manager_assignments(workspace_id, client_id, manager_id)
where source = 'profiles.manager_id.backfill';

create index if not exists client_manager_assignments_client_idx
on public.client_manager_assignments(workspace_id, client_id, assignment_status, created_at desc);

create index if not exists client_manager_assignments_manager_idx
on public.client_manager_assignments(workspace_id, manager_id, assignment_status, created_at desc);

create index if not exists client_assignment_events_workspace_idx
on public.client_assignment_events(workspace_id, created_at desc);

create index if not exists client_assignment_events_client_idx
on public.client_assignment_events(client_id, created_at desc);

create index if not exists client_assignment_events_manager_idx
on public.client_assignment_events(manager_id, created_at desc);

alter table public.client_manager_assignments enable row level security;
alter table public.client_assignment_events enable row level security;

-- ============================================================
-- 11A. Default workspace backfill from current flat account model
-- ============================================================

insert into public.workspaces (slug, name, status, owner_id, created_by, metadata_json)
values (
  'platform',
  'xDisputer Platform',
  'active',
  (
    select p.id
    from public.profiles p
    order by
      case when lower(coalesce(p.email, '')) = 'mycoquibuyen2002@gmail.com' then 0 else 1 end,
      case when p.role::text = 'master' then 0 else 1 end,
      p.created_at asc
    limit 1
  ),
  (
    select p.id
    from public.profiles p
    order by
      case when lower(coalesce(p.email, '')) = 'mycoquibuyen2002@gmail.com' then 0 else 1 end,
      case when p.role::text = 'master' then 0 else 1 end,
      p.created_at asc
    limit 1
  ),
  jsonb_build_object('source', 'phase_11_backfill')
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  owner_id = coalesce(public.workspaces.owner_id, excluded.owner_id),
  created_by = coalesce(public.workspaces.created_by, excluded.created_by),
  updated_at = now();

update public.profiles p
set default_workspace_id = w.id
from public.workspaces w
where w.slug = 'platform'
  and p.default_workspace_id is null;

insert into public.workspace_members (
  workspace_id,
  profile_id,
  workspace_role,
  membership_status,
  permissions,
  created_at,
  updated_at
)
select
  w.id,
  p.id,
  case
    when lower(coalesce(p.email, '')) = 'mycoquibuyen2002@gmail.com' then 'owner'
    when p.role::text = 'master' then 'master'
    when p.role::text in ('manager', 'admin') then 'manager'
    else 'client'
  end as workspace_role,
  case
    when p.account_status::text = 'disabled' then 'disabled'
    when p.account_status::text = 'suspended' then 'suspended'
    when p.account_status::text in ('pending_manager_assignment', 'pending_manager_approval') then 'pending'
    else 'active'
  end as membership_status,
  '{}'::jsonb,
  coalesce(p.created_at, now()),
  now()
from public.profiles p
cross join public.workspaces w
where w.slug = 'platform'
on conflict (workspace_id, profile_id) do update
set
  workspace_role = excluded.workspace_role,
  membership_status = excluded.membership_status,
  updated_at = now();

insert into public.client_manager_assignments (
  workspace_id,
  client_id,
  manager_id,
  assignment_role,
  assignment_status,
  assigned_by,
  approved_by,
  source,
  reason,
  metadata_json,
  created_at,
  approved_at,
  updated_at
)
select
  w.id,
  client.id,
  client.manager_id,
  'primary',
  case when client.account_status::text = 'active' then 'active' else 'pending' end,
  client.manager_id,
  case when client.account_status::text = 'active' then client.manager_id else null end,
  'profiles.manager_id.backfill',
  'Backfilled from profiles.manager_id during Phase 11 migration.',
  jsonb_build_object('source_account_status', client.account_status::text),
  coalesce(client.updated_at, now()),
  case when client.account_status::text = 'active' then coalesce(client.updated_at, now()) else null end,
  now()
from public.profiles client
cross join public.workspaces w
where w.slug = 'platform'
  and client.role::text = 'client'
  and client.manager_id is not null
on conflict do nothing;

insert into public.client_assignment_events (
  assignment_id,
  workspace_id,
  client_id,
  manager_id,
  actor_id,
  event_type,
  event_status,
  reason,
  metadata_json,
  created_at
)
select
  a.id,
  a.workspace_id,
  a.client_id,
  a.manager_id,
  a.assigned_by,
  'backfilled_from_profile_manager_id',
  a.assignment_status,
  a.reason,
  a.metadata_json,
  now()
from public.client_manager_assignments a
where a.source = 'profiles.manager_id.backfill'
  and not exists (
    select 1
    from public.client_assignment_events e
    where e.assignment_id = a.id
      and e.event_type = 'backfilled_from_profile_manager_id'
  );

-- ============================================================
-- 11B. Central actor context / policy engine
-- ============================================================

create or replace function public.access_get_actor_context(
  workspace_id_input uuid default null
)
returns table (
  profile_id uuid,
  email text,
  platform_role text,
  account_status text,
  workspace_id uuid,
  workspace_slug text,
  workspace_role text,
  membership_status text,
  is_platform_master boolean,
  is_workspace_owner boolean,
  can_manage_workspace boolean,
  can_manage_managers boolean,
  can_manage_clients boolean,
  can_view_system boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
  member_row public.workspace_members;
  workspace_row public.workspaces;
  resolved_workspace_id uuid;
  actor_active boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select p.*
  into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.id is null then
    raise exception 'Actor profile not found.';
  end if;

  actor_active := coalesce(actor_profile.account_status::text, 'active') not in ('disabled', 'suspended');

  resolved_workspace_id := coalesce(
    workspace_id_input,
    actor_profile.default_workspace_id,
    (select w.id from public.workspaces w where w.slug = 'platform' limit 1)
  );

  select w.*
  into workspace_row
  from public.workspaces w
  where w.id = resolved_workspace_id;

  if workspace_row.id is null then
    raise exception 'Workspace not found.';
  end if;

  select wm.*
  into member_row
  from public.workspace_members wm
  where wm.workspace_id = workspace_row.id
    and wm.profile_id = actor_profile.id;

  return query
  select
    actor_profile.id,
    actor_profile.email,
    actor_profile.role::text,
    coalesce(actor_profile.account_status::text, 'active'),
    workspace_row.id,
    workspace_row.slug,
    coalesce(member_row.workspace_role, case when actor_profile.role::text = 'master' then 'master' else 'none' end),
    coalesce(member_row.membership_status, case when actor_profile.role::text = 'master' then 'active' else 'none' end),
    actor_active and actor_profile.role::text = 'master',
    actor_active and coalesce(member_row.membership_status, case when actor_profile.role::text = 'master' then 'active' else 'none' end) = 'active'
      and coalesce(member_row.workspace_role, case when actor_profile.role::text = 'master' then 'master' else 'none' end) in ('owner', 'master'),
    actor_active and workspace_row.status = 'active' and (
      actor_profile.role::text = 'master'
      or (member_row.membership_status = 'active' and member_row.workspace_role in ('owner', 'master'))
    ),
    actor_active and workspace_row.status = 'active' and (
      actor_profile.role::text = 'master'
      or (member_row.membership_status = 'active' and member_row.workspace_role in ('owner', 'master'))
    ),
    actor_active and workspace_row.status = 'active' and (
      actor_profile.role::text = 'master'
      or (member_row.membership_status = 'active' and member_row.workspace_role in ('owner', 'master', 'manager'))
    ),
    actor_active and workspace_row.status = 'active' and (
      actor_profile.role::text = 'master'
      or (member_row.membership_status = 'active' and member_row.workspace_role in ('owner', 'master'))
    );
end;
$$;

grant execute on function public.access_get_actor_context(uuid) to authenticated;

create or replace function public.access_can_manage_account(
  target_profile_id_input uuid,
  workspace_id_input uuid default null
)
returns table (
  allowed boolean,
  reason text,
  actor_profile_id uuid,
  target_profile_id uuid,
  actor_workspace_role text,
  target_workspace_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ctx record;
  target_profile public.profiles;
  target_member public.workspace_members;
  assigned_to_actor boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select *
  into ctx
  from public.access_get_actor_context(workspace_id_input)
  limit 1;

  select p.*
  into target_profile
  from public.profiles p
  where p.id = target_profile_id_input;

  if target_profile.id is null then
    return query select false, 'Target profile not found.', auth.uid(), target_profile_id_input, coalesce(ctx.workspace_role, 'none'), 'none';
    return;
  end if;

  select wm.*
  into target_member
  from public.workspace_members wm
  where wm.workspace_id = ctx.workspace_id
    and wm.profile_id = target_profile.id;

  if target_member.id is null then
    return query select false, 'Target is not a member of this workspace.', auth.uid(), target_profile.id, coalesce(ctx.workspace_role, 'none'), 'none';
    return;
  end if;

  if ctx.can_manage_workspace then
    return query select true, 'Actor can manage workspace accounts.', auth.uid(), target_profile.id, ctx.workspace_role, target_member.workspace_role;
    return;
  end if;

  select exists (
    select 1
    from public.client_manager_assignments a
    where a.workspace_id = ctx.workspace_id
      and a.client_id = target_profile.id
      and a.manager_id = auth.uid()
      and a.assignment_status in ('pending', 'active')
  ) or target_profile.manager_id = auth.uid()
  into assigned_to_actor;

  if ctx.can_manage_clients and target_member.workspace_role = 'client' and assigned_to_actor then
    return query select true, 'Actor can manage assigned client.', auth.uid(), target_profile.id, ctx.workspace_role, target_member.workspace_role;
    return;
  end if;

  return query select false, 'Actor cannot manage this target in this workspace.', auth.uid(), target_profile.id, coalesce(ctx.workspace_role, 'none'), target_member.workspace_role;
end;
$$;

grant execute on function public.access_can_manage_account(uuid, uuid) to authenticated;

create or replace function public.access_workspace_account_directory(
  workspace_id_input uuid default null,
  view_input text default 'all',
  search_input text default null,
  page_input integer default 1,
  page_size_input integer default 25
)
returns table (
  profile_id uuid,
  email text,
  full_name text,
  platform_role text,
  account_status text,
  workspace_id uuid,
  workspace_role text,
  membership_status text,
  primary_manager_id uuid,
  primary_manager_email text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ctx record;
  clean_view text := coalesce(nullif(trim(view_input), ''), 'all');
  clean_search text := lower(nullif(trim(coalesce(search_input, '')), ''));
  clean_page integer := greatest(coalesce(page_input, 1), 1);
  clean_page_size integer := greatest(1, least(coalesce(page_size_input, 25), 100));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select *
  into ctx
  from public.access_get_actor_context(workspace_id_input)
  limit 1;

  if not ctx.can_manage_clients and not ctx.can_manage_workspace then
    raise exception 'Actor cannot view workspace account directory.';
  end if;

  return query
  with scoped_accounts as (
    select
      p.id as profile_id,
      p.email,
      p.full_name,
      p.role::text as platform_role,
      coalesce(p.account_status::text, 'active') as account_status,
      wm.workspace_id,
      wm.workspace_role,
      wm.membership_status,
      manager_link.manager_id as primary_manager_id,
      manager_profile.email as primary_manager_email,
      p.created_at,
      p.updated_at
    from public.workspace_members wm
    join public.profiles p on p.id = wm.profile_id
    left join lateral (
      select a.manager_id
      from public.client_manager_assignments a
      where a.workspace_id = wm.workspace_id
        and a.client_id = p.id
        and a.assignment_role = 'primary'
        and a.assignment_status = 'active'
      order by a.updated_at desc
      limit 1
    ) manager_link on true
    left join public.profiles manager_profile on manager_profile.id = manager_link.manager_id
    where wm.workspace_id = ctx.workspace_id
      and wm.membership_status <> 'removed'
      and (
        ctx.can_manage_workspace
        or (
          ctx.can_manage_clients
          and wm.workspace_role = 'client'
          and (
            p.manager_id = auth.uid()
            or exists (
              select 1
              from public.client_manager_assignments assigned
              where assigned.workspace_id = wm.workspace_id
                and assigned.client_id = p.id
                and assigned.manager_id = auth.uid()
                and assigned.assignment_status in ('pending', 'active')
            )
          )
        )
      )
      and (
        clean_view = 'all'
        or (clean_view = 'masters' and wm.workspace_role in ('owner', 'master'))
        or (clean_view = 'managers' and wm.workspace_role = 'manager')
        or (clean_view = 'clients' and wm.workspace_role = 'client')
        or (clean_view = 'pending' and (wm.membership_status = 'pending' or p.account_status::text like 'pending%'))
        or (clean_view = 'blocked' and (wm.membership_status in ('suspended', 'disabled') or p.account_status::text in ('suspended', 'disabled')))
      )
      and (
        clean_search is null
        or lower(coalesce(p.email, '')) like '%' || clean_search || '%'
        or lower(coalesce(p.full_name, '')) like '%' || clean_search || '%'
        or p.id::text = clean_search
      )
  ), counted as (
    select scoped_accounts.*, count(*) over() as total_count
    from scoped_accounts
  )
  select
    counted.profile_id,
    counted.email,
    counted.full_name,
    counted.platform_role,
    counted.account_status,
    counted.workspace_id,
    counted.workspace_role,
    counted.membership_status,
    counted.primary_manager_id,
    counted.primary_manager_email,
    counted.created_at,
    counted.updated_at,
    counted.total_count
  from counted
  order by counted.created_at desc
  limit clean_page_size
  offset (clean_page - 1) * clean_page_size;
end;
$$;

grant execute on function public.access_workspace_account_directory(uuid, text, text, integer, integer) to authenticated;

-- ============================================================
-- 11C. Assignment ledger actions
-- ============================================================

create or replace function public.access_workspace_assign_client(
  workspace_id_input uuid,
  client_id_input uuid,
  manager_id_input uuid,
  assignment_role_input text default 'primary',
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ctx record;
  client_member public.workspace_members;
  manager_member public.workspace_members;
  new_assignment_id uuid;
  clean_role text := coalesce(nullif(trim(assignment_role_input), ''), 'primary');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select *
  into ctx
  from public.access_get_actor_context(workspace_id_input)
  limit 1;

  if not ctx.can_manage_workspace then
    raise exception 'Only workspace owner/master can create client-manager assignments.';
  end if;

  if clean_role not in ('primary', 'reviewer', 'assistant') then
    raise exception 'Invalid assignment role.';
  end if;

  select wm.* into client_member
  from public.workspace_members wm
  where wm.workspace_id = ctx.workspace_id
    and wm.profile_id = client_id_input
    and wm.workspace_role = 'client'
    and wm.membership_status <> 'removed';

  if client_member.id is null then
    raise exception 'Client is not an active workspace client member.';
  end if;

  select wm.* into manager_member
  from public.workspace_members wm
  where wm.workspace_id = ctx.workspace_id
    and wm.profile_id = manager_id_input
    and wm.workspace_role in ('owner', 'master', 'manager')
    and wm.membership_status = 'active';

  if manager_member.id is null then
    raise exception 'Manager is not an active workspace manager member.';
  end if;

  insert into public.client_manager_assignments (
    workspace_id,
    client_id,
    manager_id,
    assignment_role,
    assignment_status,
    assigned_by,
    source,
    reason,
    metadata_json
  )
  values (
    ctx.workspace_id,
    client_id_input,
    manager_id_input,
    clean_role,
    'pending',
    auth.uid(),
    'workspace_policy_rpc',
    reason_input,
    jsonb_build_object('actor_context_role', ctx.workspace_role)
  )
  returning id into new_assignment_id;

  insert into public.client_assignment_events (
    assignment_id,
    workspace_id,
    client_id,
    manager_id,
    actor_id,
    event_type,
    event_status,
    reason,
    metadata_json
  )
  values (
    new_assignment_id,
    ctx.workspace_id,
    client_id_input,
    manager_id_input,
    auth.uid(),
    'assignment_created',
    'pending',
    reason_input,
    jsonb_build_object('assignment_role', clean_role)
  );

  return new_assignment_id;
end;
$$;

grant execute on function public.access_workspace_assign_client(uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.access_workspace_activate_client_assignment(
  assignment_id_input uuid,
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.client_manager_assignments;
  ctx record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select a.*
  into assignment_row
  from public.client_manager_assignments a
  where a.id = assignment_id_input;

  if assignment_row.id is null then
    raise exception 'Assignment not found.';
  end if;

  select *
  into ctx
  from public.access_get_actor_context(assignment_row.workspace_id)
  limit 1;

  if not ctx.can_manage_workspace and assignment_row.manager_id <> auth.uid() then
    raise exception 'Actor cannot activate this assignment.';
  end if;

  if assignment_row.assignment_role = 'primary' then
    update public.client_manager_assignments existing
    set
      assignment_status = 'transferred',
      revoked_by = auth.uid(),
      revoked_at = now(),
      updated_at = now()
    where existing.workspace_id = assignment_row.workspace_id
      and existing.client_id = assignment_row.client_id
      and existing.assignment_role = 'primary'
      and existing.assignment_status = 'active'
      and existing.id <> assignment_row.id;
  end if;

  update public.client_manager_assignments a
  set
    assignment_status = 'active',
    approved_by = auth.uid(),
    approved_at = coalesce(a.approved_at, now()),
    reason = coalesce(reason_input, a.reason),
    updated_at = now()
  where a.id = assignment_row.id;

  if assignment_row.assignment_role = 'primary' then
    update public.profiles p
    set
      manager_id = assignment_row.manager_id,
      account_status = 'active'::public.account_status,
      updated_at = now()
    where p.id = assignment_row.client_id;

    update public.workspace_members wm
    set
      membership_status = 'active',
      updated_at = now()
    where wm.workspace_id = assignment_row.workspace_id
      and wm.profile_id = assignment_row.client_id;
  end if;

  insert into public.client_assignment_events (
    assignment_id,
    workspace_id,
    client_id,
    manager_id,
    actor_id,
    event_type,
    event_status,
    reason,
    metadata_json
  )
  values (
    assignment_row.id,
    assignment_row.workspace_id,
    assignment_row.client_id,
    assignment_row.manager_id,
    auth.uid(),
    'assignment_activated',
    'active',
    reason_input,
    jsonb_build_object('assignment_role', assignment_row.assignment_role)
  );

  return assignment_row.id;
end;
$$;

grant execute on function public.access_workspace_activate_client_assignment(uuid, text) to authenticated;

create or replace function public.access_workspace_revoke_client_assignment(
  assignment_id_input uuid,
  reason_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.client_manager_assignments;
  ctx record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select a.*
  into assignment_row
  from public.client_manager_assignments a
  where a.id = assignment_id_input;

  if assignment_row.id is null then
    raise exception 'Assignment not found.';
  end if;

  select *
  into ctx
  from public.access_get_actor_context(assignment_row.workspace_id)
  limit 1;

  if not ctx.can_manage_workspace then
    raise exception 'Only workspace owner/master can revoke assignments.';
  end if;

  update public.client_manager_assignments a
  set
    assignment_status = 'revoked',
    revoked_by = auth.uid(),
    revoked_at = now(),
    reason = coalesce(reason_input, a.reason),
    updated_at = now()
  where a.id = assignment_row.id;

  if assignment_row.assignment_role = 'primary' then
    update public.profiles p
    set
      manager_id = null,
      account_status = 'pending_manager_assignment'::public.account_status,
      updated_at = now()
    where p.id = assignment_row.client_id
      and p.manager_id = assignment_row.manager_id;
  end if;

  insert into public.client_assignment_events (
    assignment_id,
    workspace_id,
    client_id,
    manager_id,
    actor_id,
    event_type,
    event_status,
    reason,
    metadata_json
  )
  values (
    assignment_row.id,
    assignment_row.workspace_id,
    assignment_row.client_id,
    assignment_row.manager_id,
    auth.uid(),
    'assignment_revoked',
    'revoked',
    reason_input,
    jsonb_build_object('assignment_role', assignment_row.assignment_role)
  );

  return assignment_row.id;
end;
$$;

grant execute on function public.access_workspace_revoke_client_assignment(uuid, text) to authenticated;

analyze public.workspaces;
analyze public.workspace_members;
analyze public.workspace_invites;
analyze public.client_manager_assignments;
analyze public.client_assignment_events;
analyze public.profiles;

notify pgrst, 'reload schema';
