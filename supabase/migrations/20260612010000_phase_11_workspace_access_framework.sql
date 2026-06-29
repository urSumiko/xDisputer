-- Phase 11 — Multi-Tenant Access Framework
-- Scope:
--   11A: Workspaces + workspace memberships + workspace invites
--   11B: Central access policy RPCs
--   11C: Client-manager assignment ledger
--
-- Safety rules:
--   - Additive migration only.
--   - No quota enforcement.
--   - No generation output limits.
--   - Existing profiles.manager_id remains as compatibility pointer.
--   - Workspace assignment ledger becomes the stronger source of truth.

create extension if not exists pgcrypto;

-- ============================================================
-- 11A. Workspace / tenant foundation
-- ============================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  workspace_status text not null default 'active'
    check (workspace_status in ('active', 'suspended', 'disabled')),
  created_by uuid null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('master', 'manager', 'client')),
  member_scope text not null default 'workspace' check (member_scope in ('platform', 'workspace')),
  membership_status text not null default 'active'
    check (membership_status in ('pending', 'active', 'suspended', 'disabled')),
  is_primary boolean not null default true,
  created_by uuid null,
  joined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid null references public.profiles(id) on delete set null,
  invite_code text not null unique,
  invite_role text not null check (invite_role in ('master', 'manager', 'client')),
  invite_status text not null default 'active'
    check (invite_status in ('active', 'revoked', 'expired', 'used')),
  expires_at timestamptz null,
  used_by uuid null references public.profiles(id) on delete set null,
  used_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 11C. Client assignment ledger
-- ============================================================

create table if not exists public.client_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null default 'primary'
    check (assignment_role in ('primary', 'reviewer', 'assistant')),
  assignment_status text not null default 'pending'
    check (assignment_status in ('pending', 'active', 'revoked', 'transferred')),
  requested_by uuid null references public.profiles(id) on delete set null,
  assigned_by uuid null references public.profiles(id) on delete set null,
  approved_by uuid null references public.profiles(id) on delete set null,
  revoked_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  revoked_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.client_assignment_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid null references public.client_manager_assignments(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid null references public.profiles(id) on delete set null,
  actor_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  from_status text null,
  to_status text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists workspaces_status_idx
on public.workspaces(workspace_status, created_at desc);

create index if not exists workspace_members_profile_idx
on public.workspace_members(profile_id, membership_status, created_at desc);

create index if not exists workspace_members_workspace_role_idx
on public.workspace_members(workspace_id, member_role, membership_status, created_at desc);

create index if not exists workspace_invites_workspace_status_idx
on public.workspace_invites(workspace_id, invite_status, created_at desc);

create index if not exists client_assignments_workspace_client_idx
on public.client_manager_assignments(workspace_id, client_id, assignment_status, created_at desc);

create index if not exists client_assignments_workspace_manager_idx
on public.client_manager_assignments(workspace_id, manager_id, assignment_status, created_at desc);

create index if not exists client_assignment_events_workspace_idx
on public.client_assignment_events(workspace_id, created_at desc);

create unique index if not exists client_assignments_one_active_primary_idx
on public.client_manager_assignments(workspace_id, client_id)
where assignment_status = 'active' and assignment_role = 'primary';

-- Keep these tables callable through security-definer RPCs first.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.client_manager_assignments enable row level security;
alter table public.client_assignment_events enable row level security;

-- ============================================================
-- Internal helpers
-- ============================================================

create or replace function public.access_default_workspace_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_output uuid;
begin
  select w.id
  into workspace_id_output
  from public.workspaces w
  where w.slug = 'default'
  limit 1;

  if workspace_id_output is null then
    insert into public.workspaces (name, slug, workspace_status, metadata_json)
    values (
      'xDisputer Default Workspace',
      'default',
      'active',
      jsonb_build_object('system_created', true, 'phase', '11A')
    )
    returning id into workspace_id_output;
  end if;

  return workspace_id_output;
end;
$$;

grant execute on function public.access_default_workspace_id() to authenticated;

create or replace function public.access_normalized_member_status(profile_status text, profile_role text)
returns text
language sql
stable
as $$
  select case
    when coalesce(profile_role, 'client') in ('master', 'manager', 'admin') then
      case when profile_status in ('disabled', 'suspended') then profile_status else 'active' end
    when profile_status in ('active', 'disabled', 'suspended') then profile_status
    when profile_status in ('pending_manager_assignment', 'pending_manager_approval') then 'pending'
    else 'pending'
  end;
$$;

create or replace function public.access_ensure_default_workspace_membership(
  target_profile_id_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  target_profile public.profiles;
  member_id_output uuid;
  normalized_role text;
  normalized_status text;
  normalized_scope text;
begin
  workspace_id_value := public.access_default_workspace_id();

  select p.*
  into target_profile
  from public.profiles p
  where p.id = coalesce(target_profile_id_input, auth.uid());

  if target_profile.id is null then
    raise exception 'Target profile not found.';
  end if;

  normalized_role := case
    when target_profile.role::text = 'admin' then 'manager'
    when target_profile.role::text in ('master', 'manager', 'client') then target_profile.role::text
    else 'client'
  end;

  normalized_status := public.access_normalized_member_status(target_profile.account_status::text, normalized_role);
  normalized_scope := case when normalized_role = 'master' then 'platform' else 'workspace' end;

  insert into public.workspace_members (
    workspace_id,
    profile_id,
    member_role,
    member_scope,
    membership_status,
    is_primary,
    created_by,
    joined_at
  )
  values (
    workspace_id_value,
    target_profile.id,
    normalized_role,
    normalized_scope,
    normalized_status,
    true,
    auth.uid(),
    case when normalized_status = 'active' then now() else null end
  )
  on conflict (workspace_id, profile_id)
  do update set
    member_role = excluded.member_role,
    member_scope = excluded.member_scope,
    membership_status = excluded.membership_status,
    updated_at = now(),
    joined_at = case
      when excluded.membership_status = 'active' and public.workspace_members.joined_at is null then now()
      else public.workspace_members.joined_at
    end
  returning id into member_id_output;

  return member_id_output;
end;
$$;

grant execute on function public.access_ensure_default_workspace_membership(uuid) to authenticated;

create or replace function public.access_actor_workspace_role(
  workspace_id_input uuid,
  actor_id_input uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
  actor_member public.workspace_members;
begin
  if actor_id_input is null then
    return null;
  end if;

  select p.*
  into actor_profile
  from public.profiles p
  where p.id = actor_id_input;

  if actor_profile.role::text = 'master' then
    return 'master';
  end if;

  select wm.*
  into actor_member
  from public.workspace_members wm
  where wm.workspace_id = workspace_id_input
    and wm.profile_id = actor_id_input
    and wm.membership_status = 'active'
  limit 1;

  return actor_member.member_role;
end;
$$;

grant execute on function public.access_actor_workspace_role(uuid, uuid) to authenticated;

create or replace function public.access_log_assignment_event(
  assignment_id_input uuid,
  workspace_id_input uuid,
  client_id_input uuid,
  manager_id_input uuid,
  event_type_input text,
  from_status_input text default null,
  to_status_input text default null,
  metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id_output uuid;
begin
  insert into public.client_assignment_events (
    assignment_id,
    workspace_id,
    client_id,
    manager_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata_json
  )
  values (
    assignment_id_input,
    workspace_id_input,
    client_id_input,
    manager_id_input,
    auth.uid(),
    coalesce(nullif(trim(event_type_input), ''), 'assignment_event'),
    from_status_input,
    to_status_input,
    coalesce(metadata_json_input, '{}'::jsonb)
  )
  returning id into event_id_output;

  return event_id_output;
end;
$$;

-- ============================================================
-- 11B. Central access policy RPCs
-- ============================================================

create or replace function public.access_get_actor_context(
  workspace_id_input uuid default null
)
returns table (
  actor_id uuid,
  actor_email text,
  platform_role text,
  workspace_id uuid,
  workspace_role text,
  member_scope text,
  is_platform_master boolean,
  is_workspace_master boolean,
  is_manager boolean,
  is_client boolean,
  can_manage_accounts boolean,
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
  workspace_id_value uuid;
  actor_member public.workspace_members;
  role_value text;
  scope_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());

  perform public.access_ensure_default_workspace_membership(auth.uid());

  select p.*
  into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  select wm.*
  into actor_member
  from public.workspace_members wm
  where wm.workspace_id = workspace_id_value
    and wm.profile_id = auth.uid()
  limit 1;

  role_value := case
    when actor_profile.role::text = 'master' then 'master'
    when actor_member.member_role is not null then actor_member.member_role
    when actor_profile.role::text = 'admin' then 'manager'
    else actor_profile.role::text
  end;

  scope_value := coalesce(actor_member.member_scope, case when role_value = 'master' then 'platform' else 'workspace' end);

  return query
  select
    actor_profile.id,
    actor_profile.email,
    actor_profile.role::text,
    workspace_id_value,
    role_value,
    scope_value,
    actor_profile.role::text = 'master' and scope_value = 'platform',
    role_value = 'master',
    role_value = 'manager',
    role_value = 'client',
    role_value in ('master', 'manager'),
    role_value = 'master',
    role_value in ('master', 'manager'),
    actor_profile.role::text = 'master';
end;
$$;

grant execute on function public.access_get_actor_context(uuid) to authenticated;

create or replace function public.access_can_manage_account(
  workspace_id_input uuid,
  target_profile_id_input uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles;
  actor_member public.workspace_members;
  target_member public.workspace_members;
  active_assignment public.client_manager_assignments;
begin
  if auth.uid() is null then
    return false;
  end if;

  select p.* into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.role::text = 'master' then
    return true;
  end if;

  select wm.* into actor_member
  from public.workspace_members wm
  where wm.workspace_id = workspace_id_input
    and wm.profile_id = auth.uid()
    and wm.membership_status = 'active'
  limit 1;

  if actor_member.member_role = 'master' then
    return true;
  end if;

  select wm.* into target_member
  from public.workspace_members wm
  where wm.workspace_id = workspace_id_input
    and wm.profile_id = target_profile_id_input
  limit 1;

  if actor_member.member_role = 'manager' and target_member.member_role = 'client' then
    select ca.* into active_assignment
    from public.client_manager_assignments ca
    where ca.workspace_id = workspace_id_input
      and ca.client_id = target_profile_id_input
      and ca.manager_id = auth.uid()
      and ca.assignment_status in ('active', 'pending')
    limit 1;

    return active_assignment.id is not null;
  end if;

  return false;
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
  member_scope text,
  membership_status text,
  primary_manager_id uuid,
  primary_manager_email text,
  assignment_status text,
  created_at timestamptz,
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
      p.id as profile_id,
      p.email,
      p.full_name,
      p.role::text as platform_role,
      p.account_status::text as account_status,
      wm.workspace_id,
      wm.member_role as workspace_role,
      wm.member_scope,
      wm.membership_status,
      pm.id as primary_manager_id,
      pm.email as primary_manager_email,
      ca.assignment_status,
      p.created_at
    from public.workspace_members wm
    join public.profiles p on p.id = wm.profile_id
    left join public.client_manager_assignments ca
      on ca.workspace_id = wm.workspace_id
      and ca.client_id = p.id
      and ca.assignment_role = 'primary'
      and ca.assignment_status in ('pending', 'active')
    left join public.profiles pm on pm.id = ca.manager_id
    where wm.workspace_id = workspace_id_value
      and (
        actor_role_value = 'master'
        or (actor_role_value = 'manager' and (
          wm.profile_id = auth.uid()
          or ca.manager_id = auth.uid()
        ))
      )
      and (
        coalesce(view_input, 'all') = 'all'
        or (view_input = 'masters' and wm.member_role = 'master')
        or (view_input = 'managers' and wm.member_role = 'manager')
        or (view_input = 'clients' and wm.member_role = 'client')
        or (view_input = 'pending' and (wm.membership_status = 'pending' or p.account_status::text like 'pending%'))
        or (view_input = 'blocked' and (wm.membership_status in ('suspended', 'disabled') or p.account_status::text in ('suspended', 'disabled')))
      )
      and (
        nullif(trim(coalesce(search_input, '')), '') is null
        or p.email ilike '%' || trim(search_input) || '%'
        or p.full_name ilike '%' || trim(search_input) || '%'
        or p.id::text ilike '%' || trim(search_input) || '%'
        or pm.email ilike '%' || trim(search_input) || '%'
      )
  ), counted as (
    select base.*, count(*) over() as total_count
    from base
  )
  select
    counted.profile_id,
    counted.email,
    counted.full_name,
    counted.platform_role,
    counted.account_status,
    counted.workspace_id,
    counted.workspace_role,
    counted.member_scope,
    counted.membership_status,
    counted.primary_manager_id,
    counted.primary_manager_email,
    counted.assignment_status,
    counted.created_at,
    counted.total_count
  from counted
  order by counted.created_at desc
  limit safe_size offset offset_count;
end;
$$;

grant execute on function public.access_workspace_account_directory(uuid, text, text, integer, integer) to authenticated;

-- ============================================================
-- 11C. Client assignment / transfer RPCs
-- ============================================================

create or replace function public.access_workspace_assign_client(
  workspace_id_input uuid,
  client_id_input uuid,
  manager_id_input uuid,
  assignment_role_input text default 'primary'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  manager_profile public.profiles;
  client_profile public.profiles;
  assignment_id_output uuid;
  role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());
  role_value := coalesce(nullif(trim(assignment_role_input), ''), 'primary');

  if actor_role_value <> 'master' then
    raise exception 'Only master can assign or transfer clients.';
  end if;

  if role_value not in ('primary', 'reviewer', 'assistant') then
    raise exception 'Invalid assignment role.';
  end if;

  select p.* into manager_profile from public.profiles p where p.id = manager_id_input;
  select p.* into client_profile from public.profiles p where p.id = client_id_input;

  if manager_profile.id is null or manager_profile.role::text not in ('manager', 'admin') then
    raise exception 'Target manager is not a manager profile.';
  end if;

  if client_profile.id is null or client_profile.role::text <> 'client' then
    raise exception 'Target client is not a client profile.';
  end if;

  perform public.access_ensure_default_workspace_membership(manager_id_input);
  perform public.access_ensure_default_workspace_membership(client_id_input);

  if role_value = 'primary' then
    update public.client_manager_assignments
    set assignment_status = 'transferred', revoked_by = auth.uid(), revoked_at = now()
    where workspace_id = workspace_id_value
      and client_id = client_id_input
      and assignment_role = 'primary'
      and assignment_status = 'active';
  end if;

  insert into public.client_manager_assignments (
    workspace_id,
    client_id,
    manager_id,
    assignment_role,
    assignment_status,
    requested_by,
    assigned_by,
    approved_by,
    approved_at,
    metadata_json
  )
  values (
    workspace_id_value,
    client_id_input,
    manager_id_input,
    role_value,
    'active',
    auth.uid(),
    auth.uid(),
    auth.uid(),
    now(),
    jsonb_build_object('source', 'access_workspace_assign_client')
  )
  returning id into assignment_id_output;

  if role_value = 'primary' then
    update public.profiles
    set manager_id = manager_id_input,
        account_status = case when account_status::text = 'disabled' then account_status else 'active'::public.account_status end,
        updated_at = now()
    where id = client_id_input;
  end if;

  perform public.access_log_assignment_event(
    assignment_id_output,
    workspace_id_value,
    client_id_input,
    manager_id_input,
    'assigned',
    null,
    'active',
    jsonb_build_object('assignment_role', role_value)
  );

  return assignment_id_output;
end;
$$;

grant execute on function public.access_workspace_assign_client(uuid, uuid, uuid, text) to authenticated;

create or replace function public.access_workspace_approve_client(
  workspace_id_input uuid,
  client_id_input uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  assignment_record public.client_manager_assignments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Not allowed to approve clients.';
  end if;

  select ca.* into assignment_record
  from public.client_manager_assignments ca
  where ca.workspace_id = workspace_id_value
    and ca.client_id = client_id_input
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and (actor_role_value = 'master' or ca.manager_id = auth.uid())
  order by ca.created_at desc
  limit 1;

  if assignment_record.id is null then
    raise exception 'No manageable client assignment found.';
  end if;

  update public.client_manager_assignments
  set assignment_status = 'active', approved_by = auth.uid(), approved_at = coalesce(approved_at, now())
  where id = assignment_record.id;

  update public.profiles
  set manager_id = assignment_record.manager_id,
      account_status = 'active'::public.account_status,
      updated_at = now()
  where id = client_id_input;

  update public.workspace_members
  set membership_status = 'active', joined_at = coalesce(joined_at, now()), updated_at = now()
  where workspace_id = workspace_id_value and profile_id = client_id_input;

  perform public.access_log_assignment_event(
    assignment_record.id,
    workspace_id_value,
    client_id_input,
    assignment_record.manager_id,
    'approved',
    assignment_record.assignment_status,
    'active',
    '{}'::jsonb
  );

  return true;
end;
$$;

grant execute on function public.access_workspace_approve_client(uuid, uuid) to authenticated;

create or replace function public.access_workspace_transfer_client(
  workspace_id_input uuid,
  client_id_input uuid,
  to_manager_id_input uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.access_workspace_assign_client(
    coalesce(workspace_id_input, public.access_default_workspace_id()),
    client_id_input,
    to_manager_id_input,
    'primary'
  );
end;
$$;

grant execute on function public.access_workspace_transfer_client(uuid, uuid, uuid) to authenticated;

create or replace function public.access_workspace_revoke_client_assignment(
  workspace_id_input uuid,
  client_id_input uuid,
  manager_id_input uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  assignment_record public.client_manager_assignments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := coalesce(workspace_id_input, public.access_default_workspace_id());
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value <> 'master' then
    raise exception 'Only master can revoke client assignments.';
  end if;

  select ca.* into assignment_record
  from public.client_manager_assignments ca
  where ca.workspace_id = workspace_id_value
    and ca.client_id = client_id_input
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and (manager_id_input is null or ca.manager_id = manager_id_input)
  order by ca.created_at desc
  limit 1;

  if assignment_record.id is null then
    raise exception 'No active assignment found.';
  end if;

  update public.client_manager_assignments
  set assignment_status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  where id = assignment_record.id;

  update public.profiles
  set manager_id = null,
      account_status = case when account_status::text = 'disabled' then account_status else 'pending_manager_assignment'::public.account_status end,
      updated_at = now()
  where id = client_id_input;

  perform public.access_log_assignment_event(
    assignment_record.id,
    workspace_id_value,
    client_id_input,
    assignment_record.manager_id,
    'revoked',
    assignment_record.assignment_status,
    'revoked',
    '{}'::jsonb
  );

  return true;
end;
$$;

grant execute on function public.access_workspace_revoke_client_assignment(uuid, uuid, uuid) to authenticated;

-- ============================================================
-- Backfill current production state into default workspace
-- ============================================================

do $$
declare
  default_workspace_id uuid;
  profile_record public.profiles;
  assignment_id_value uuid;
begin
  default_workspace_id := public.access_default_workspace_id();

  for profile_record in select * from public.profiles loop
    perform public.access_ensure_default_workspace_membership(profile_record.id);
  end loop;

  for profile_record in
    select * from public.profiles
    where role::text = 'client'
      and manager_id is not null
  loop
    insert into public.client_manager_assignments (
      workspace_id,
      client_id,
      manager_id,
      assignment_role,
      assignment_status,
      requested_by,
      assigned_by,
      approved_by,
      approved_at,
      metadata_json
    )
    values (
      default_workspace_id,
      profile_record.id,
      profile_record.manager_id,
      'primary',
      case when profile_record.account_status::text = 'pending_manager_approval' then 'pending' else 'active' end,
      profile_record.id,
      profile_record.manager_id,
      case when profile_record.account_status::text = 'pending_manager_approval' then null else profile_record.manager_id end,
      case when profile_record.account_status::text = 'pending_manager_approval' then null else now() end,
      jsonb_build_object('backfilled_from_profiles_manager_id', true)
    )
    on conflict do nothing
    returning id into assignment_id_value;

    if assignment_id_value is not null then
      perform public.access_log_assignment_event(
        assignment_id_value,
        default_workspace_id,
        profile_record.id,
        profile_record.manager_id,
        'backfilled',
        null,
        case when profile_record.account_status::text = 'pending_manager_approval' then 'pending' else 'active' end,
        jsonb_build_object('phase', '11C')
      );
    end if;
  end loop;
end $$;

analyze public.workspaces;
analyze public.workspace_members;
analyze public.workspace_invites;
analyze public.client_manager_assignments;
analyze public.client_assignment_events;
analyze public.profiles;

notify pgrst, 'reload schema';
