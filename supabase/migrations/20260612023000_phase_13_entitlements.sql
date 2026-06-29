-- Phase 13 — SaaS entitlement limits
-- Adds master-controlled manager client-seat limits and client output limits.
-- Safety: additive tables, additive functions, additive trigger. Existing rows remain unlimited until configured.

create table if not exists public.manager_entitlement_limits (
  manager_id uuid primary key references public.profiles(id) on delete cascade,
  max_clients integer null check (max_clients is null or max_clients >= 0),
  default_client_output_limit integer null check (default_client_output_limit is null or default_client_output_limit >= 0),
  notes text null,
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_entitlement_limits (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  manager_id uuid null references public.profiles(id) on delete set null,
  output_limit integer null check (output_limit is null or output_limit >= 0),
  notes text null,
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_entitlement_limits_manager
  on public.client_entitlement_limits(manager_id, client_id);

create index if not exists idx_generation_runs_owner_month
  on public.generation_runs(owner_id, created_at desc)
  where output_status in ('generated', 'downloaded');

alter table public.manager_entitlement_limits enable row level security;
alter table public.client_entitlement_limits enable row level security;

revoke all on public.manager_entitlement_limits from anon, authenticated;
revoke all on public.client_entitlement_limits from anon, authenticated;

create or replace function public.access_is_master(actor_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = actor_id
      and p.role::text = 'master'
      and coalesce(p.account_status::text, 'active') = 'active'
  );
$$;

create or replace function public.access_list_entitlement_limits_v1(profile_ids uuid[] default null)
returns table (
  profile_id uuid,
  max_clients integer,
  current_clients integer,
  default_client_output_limit integer,
  client_output_limit integer,
  effective_output_limit integer,
  output_used_this_month integer,
  output_remaining_this_month integer,
  entitlement_notes text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if not public.access_is_master(auth.uid())
     and not exists (
       select 1
       from public.workspace_members wm
       where wm.profile_id = auth.uid()
         and wm.member_role in ('manager', 'master')
         and wm.membership_status = 'active'
     ) then
    raise exception 'Not allowed to view entitlement limits.';
  end if;

  return query
  with selected_profiles as (
    select p.id, p.role::text as role, p.manager_id
    from public.profiles p
    where profile_ids is null or p.id = any(profile_ids)
  ), client_counts as (
    select ca.manager_id, count(distinct ca.client_id)::integer as current_clients
    from public.client_manager_assignments ca
    join public.profiles cp on cp.id = ca.client_id
    where ca.assignment_role = 'primary'
      and ca.assignment_status in ('pending', 'active')
      and coalesce(cp.account_status::text, 'active') not in ('disabled', 'suspended')
    group by ca.manager_id
  ), monthly_outputs as (
    select gr.owner_id, count(*)::integer as output_used
    from public.generation_runs gr
    where gr.created_at >= date_trunc('month', now())
      and gr.output_status in ('generated', 'downloaded')
    group by gr.owner_id
  )
  select
    sp.id as profile_id,
    mel.max_clients,
    coalesce(cc.current_clients, 0) as current_clients,
    mel.default_client_output_limit,
    cel.output_limit as client_output_limit,
    coalesce(cel.output_limit, mel2.default_client_output_limit) as effective_output_limit,
    coalesce(mo.output_used, 0) as output_used_this_month,
    case
      when coalesce(cel.output_limit, mel2.default_client_output_limit) is null then null
      else greatest(coalesce(cel.output_limit, mel2.default_client_output_limit) - coalesce(mo.output_used, 0), 0)
    end as output_remaining_this_month,
    coalesce(cel.notes, mel.notes) as entitlement_notes,
    coalesce(cel.updated_at, mel.updated_at) as updated_at
  from selected_profiles sp
  left join public.manager_entitlement_limits mel on mel.manager_id = sp.id
  left join client_counts cc on cc.manager_id = sp.id
  left join public.client_entitlement_limits cel on cel.client_id = sp.id
  left join public.manager_entitlement_limits mel2 on mel2.manager_id = coalesce(cel.manager_id, sp.manager_id)
  left join monthly_outputs mo on mo.owner_id = sp.id;
end;
$$;

grant execute on function public.access_list_entitlement_limits_v1(uuid[]) to authenticated;

create or replace function public.access_set_manager_entitlement_v1(
  manager_id_input uuid,
  max_clients_input integer default null,
  default_client_output_limit_input integer default null,
  notes_input text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.access_is_master(auth.uid()) then
    raise exception 'Only master can edit manager limits.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = manager_id_input
      and p.role::text in ('admin', 'manager')
  ) then
    raise exception 'Target account is not a manager.';
  end if;

  insert into public.manager_entitlement_limits(manager_id, max_clients, default_client_output_limit, notes, updated_by, updated_at)
  values (
    manager_id_input,
    greatest(max_clients_input, 0),
    greatest(default_client_output_limit_input, 0),
    nullif(left(coalesce(notes_input, ''), 240), ''),
    auth.uid(),
    now()
  )
  on conflict (manager_id) do update set
    max_clients = excluded.max_clients,
    default_client_output_limit = excluded.default_client_output_limit,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

grant execute on function public.access_set_manager_entitlement_v1(uuid, integer, integer, text) to authenticated;

create or replace function public.access_set_client_entitlement_v1(
  client_id_input uuid,
  output_limit_input integer default null,
  notes_input text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_id_value uuid;
begin
  if auth.uid() is null or not public.access_is_master(auth.uid()) then
    raise exception 'Only master can edit client output limits.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = client_id_input
      and p.role::text = 'client'
  ) then
    raise exception 'Target account is not a client.';
  end if;

  select coalesce(ca.manager_id, p.manager_id)
  into manager_id_value
  from public.profiles p
  left join public.client_manager_assignments ca
    on ca.client_id = p.id
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
  where p.id = client_id_input
  order by ca.created_at desc nulls last
  limit 1;

  insert into public.client_entitlement_limits(client_id, manager_id, output_limit, notes, updated_by, updated_at)
  values (
    client_id_input,
    manager_id_value,
    greatest(output_limit_input, 0),
    nullif(left(coalesce(notes_input, ''), 240), ''),
    auth.uid(),
    now()
  )
  on conflict (client_id) do update set
    manager_id = excluded.manager_id,
    output_limit = excluded.output_limit,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

grant execute on function public.access_set_client_entitlement_v1(uuid, integer, text) to authenticated;

create or replace function public.access_check_manager_client_limit_v1(manager_id_input uuid)
returns table (
  allowed boolean,
  max_clients integer,
  current_clients integer,
  remaining_clients integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  max_clients_value integer;
  current_clients_value integer;
begin
  select mel.max_clients into max_clients_value
  from public.manager_entitlement_limits mel
  where mel.manager_id = manager_id_input;

  select count(distinct ca.client_id)::integer into current_clients_value
  from public.client_manager_assignments ca
  join public.profiles cp on cp.id = ca.client_id
  where ca.manager_id = manager_id_input
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and coalesce(cp.account_status::text, 'active') not in ('disabled', 'suspended');

  return query select
    (max_clients_value is null or current_clients_value < max_clients_value) as allowed,
    max_clients_value,
    current_clients_value,
    case when max_clients_value is null then null else greatest(max_clients_value - current_clients_value, 0) end as remaining_clients,
    case
      when max_clients_value is null or current_clients_value < max_clients_value then null
      else 'Manager client limit reached. Ask master to increase this manager agreement limit.'
    end as message;
end;
$$;

grant execute on function public.access_check_manager_client_limit_v1(uuid) to authenticated;

create or replace function public.access_check_generation_output_limit_v1(owner_id_input uuid default auth.uid())
returns table (
  allowed boolean,
  output_limit integer,
  output_used_this_month integer,
  output_remaining_this_month integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_id_value uuid;
  limit_value integer;
  used_value integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if owner_id_input <> auth.uid() and not public.access_is_master(auth.uid()) then
    raise exception 'Not allowed to check another account output limit.';
  end if;

  select coalesce(cel.manager_id, ca.manager_id, p.manager_id)
  into manager_id_value
  from public.profiles p
  left join public.client_entitlement_limits cel on cel.client_id = p.id
  left join public.client_manager_assignments ca
    on ca.client_id = p.id
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
  where p.id = owner_id_input
  order by ca.created_at desc nulls last
  limit 1;

  select coalesce(cel.output_limit, mel.default_client_output_limit)
  into limit_value
  from public.profiles p
  left join public.client_entitlement_limits cel on cel.client_id = p.id
  left join public.manager_entitlement_limits mel on mel.manager_id = coalesce(cel.manager_id, manager_id_value, p.manager_id)
  where p.id = owner_id_input;

  select count(*)::integer
  into used_value
  from public.generation_runs gr
  where gr.owner_id = owner_id_input
    and gr.created_at >= date_trunc('month', now())
    and gr.output_status in ('generated', 'downloaded');

  return query select
    (limit_value is null or used_value < limit_value) as allowed,
    limit_value,
    used_value,
    case when limit_value is null then null else greatest(limit_value - used_value, 0) end as output_remaining_this_month,
    case
      when limit_value is null or used_value < limit_value then null
      else 'Monthly output limit reached. Ask your manager or master account to review your agreement.'
    end as message;
end;
$$;

grant execute on function public.access_check_generation_output_limit_v1(uuid) to authenticated;

create or replace function public.access_enforce_manager_client_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  check_row record;
begin
  if new.assignment_role = 'primary'
     and new.assignment_status in ('pending', 'active')
     and new.manager_id is not null then
    select * into check_row
    from public.access_check_manager_client_limit_v1(new.manager_id)
    limit 1;

    if check_row.allowed is false then
      raise exception '%', check_row.message;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_access_enforce_manager_client_limit on public.client_manager_assignments;
create trigger trg_access_enforce_manager_client_limit
before insert or update of manager_id, assignment_status, assignment_role
on public.client_manager_assignments
for each row
execute function public.access_enforce_manager_client_limit_trigger();

notify pgrst, 'reload schema';
