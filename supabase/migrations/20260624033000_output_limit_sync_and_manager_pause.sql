-- Output limit sync + manager Pause wiring
-- Preserves NULL limits as default, reads current manager assignment first, and adds manager Pause.

create or replace function public.access_limit_or_null_v1(limit_input integer)
returns integer
language sql
immutable
as $$
  select case when limit_input is null then null else greatest(limit_input, 0) end;
$$;

grant execute on function public.access_limit_or_null_v1(integer) to authenticated;

create or replace function public.access_current_client_manager_id_v1(client_id_input uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  manager_id_output uuid;
begin
  select ca.manager_id
  into manager_id_output
  from public.client_manager_assignments ca
  where ca.client_id = client_id_input
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('active', 'pending')
  order by
    case when ca.assignment_status = 'active' then 0 else 1 end,
    ca.approved_at desc nulls last,
    ca.created_at desc nulls last
  limit 1;

  if manager_id_output is not null then return manager_id_output; end if;

  select p.manager_id into manager_id_output
  from public.profiles p
  where p.id = client_id_input;

  if manager_id_output is not null then return manager_id_output; end if;

  select cel.manager_id into manager_id_output
  from public.client_entitlement_limits cel
  where cel.client_id = client_id_input;

  return manager_id_output;
end;
$$;

grant execute on function public.access_current_client_manager_id_v1(uuid) to authenticated;

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
    where p.id = manager_id_input and p.role::text in ('admin', 'manager')
  ) then
    raise exception 'Target account is not a manager.';
  end if;

  insert into public.manager_entitlement_limits(manager_id, max_clients, default_client_output_limit, notes, updated_by, updated_at)
  values (
    manager_id_input,
    public.access_limit_or_null_v1(max_clients_input),
    public.access_limit_or_null_v1(default_client_output_limit_input),
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
    where p.id = client_id_input and p.role::text = 'client'
  ) then
    raise exception 'Target account is not a client.';
  end if;

  manager_id_value := public.access_current_client_manager_id_v1(client_id_input);

  insert into public.client_entitlement_limits(client_id, manager_id, output_limit, notes, updated_by, updated_at)
  values (
    client_id_input,
    manager_id_value,
    public.access_limit_or_null_v1(output_limit_input),
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

create or replace function public.access_client_daily_output_entitlement_v1(owner_id_input uuid default auth.uid())
returns table (
  allowed boolean,
  output_limit integer,
  output_used_today integer,
  output_remaining_today integer,
  reset_at timestamptz,
  reset_seconds integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
  manager_id_value uuid;
  limit_value integer;
  used_value integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select p.role::text into actor_role_value
  from public.profiles p
  where p.id = auth.uid();

  if owner_id_input <> auth.uid()
    and actor_role_value <> 'master'
    and not exists (
      select 1
      from public.client_manager_assignments ca
      where ca.client_id = owner_id_input
        and ca.manager_id = auth.uid()
        and ca.assignment_status in ('pending', 'active')
    ) then
    raise exception 'Not allowed to view this output entitlement.';
  end if;

  manager_id_value := public.access_current_client_manager_id_v1(owner_id_input);

  select coalesce(cel.output_limit, mel.default_client_output_limit)
  into limit_value
  from public.profiles p
  left join public.client_entitlement_limits cel on cel.client_id = p.id
  left join public.manager_entitlement_limits mel on mel.manager_id = manager_id_value
  where p.id = owner_id_input;

  select count(*)::integer
  into used_value
  from public.generation_runs gr
  where gr.owner_id = owner_id_input
    and gr.created_at >= public.access_us_eastern_day_start()
    and gr.created_at < public.access_us_eastern_next_day_start()
    and public.access_generation_run_counts_as_output(gr.output_status::text);

  return query select
    (limit_value is null or used_value < limit_value) as allowed,
    limit_value as output_limit,
    used_value as output_used_today,
    case when limit_value is null then null else greatest(limit_value - used_value, 0) end as output_remaining_today,
    public.access_us_eastern_next_day_start() as reset_at,
    greatest(extract(epoch from (public.access_us_eastern_next_day_start() - now()))::integer, 0) as reset_seconds,
    case
      when limit_value is null or used_value < limit_value then null
      else 'Daily output limit reached. This Disputer allowance resets at the next US Eastern day.'
    end as message;
end;
$$;

grant execute on function public.access_client_daily_output_entitlement_v1(uuid) to authenticated;

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
begin
  return query
  select d.allowed, d.output_limit, d.output_used_today, d.output_remaining_today, d.message
  from public.access_client_daily_output_entitlement_v1(owner_id_input) d;
end;
$$;

grant execute on function public.access_check_generation_output_limit_v1(uuid) to authenticated;

create or replace function public.access_list_daily_entitlement_limits_v1(profile_ids uuid[] default null)
returns table (
  profile_id uuid,
  max_clients integer,
  current_clients integer,
  default_client_output_limit integer,
  client_output_limit integer,
  effective_output_limit integer,
  output_used_today integer,
  output_remaining_today integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select role::text into actor_role_value from public.profiles where id = auth.uid();

  if actor_role_value not in ('master', 'manager', 'admin', 'client') then
    raise exception 'Not allowed to view entitlement limits.';
  end if;

  return query
  with selected_profiles as (
    select p.id, p.role::text as role, p.manager_id
    from public.profiles p
    where (profile_ids is null or p.id = any(profile_ids))
      and (
        actor_role_value = 'master'
        or p.id = auth.uid()
        or p.manager_id = auth.uid()
        or exists (
          select 1 from public.client_manager_assignments ca
          where ca.client_id = p.id
            and ca.manager_id = auth.uid()
            and ca.assignment_status in ('pending', 'active')
        )
      )
  ), primary_assignments as (
    select distinct on (ca.client_id) ca.client_id, ca.manager_id
    from public.client_manager_assignments ca
    where ca.assignment_role = 'primary'
      and ca.assignment_status in ('active', 'pending')
    order by ca.client_id,
      case when ca.assignment_status = 'active' then 0 else 1 end,
      ca.approved_at desc nulls last,
      ca.created_at desc nulls last
  ), client_counts as (
    select pa.manager_id, count(distinct pa.client_id)::integer as current_clients
    from primary_assignments pa
    join public.profiles cp on cp.id = pa.client_id
    where coalesce(cp.account_status::text, 'active') not in ('disabled', 'suspended')
    group by pa.manager_id
  ), daily_outputs as (
    select gr.owner_id, count(*)::integer as output_used
    from public.generation_runs gr
    where gr.created_at >= public.access_us_eastern_day_start()
      and gr.created_at < public.access_us_eastern_next_day_start()
      and public.access_generation_run_counts_as_output(gr.output_status::text)
    group by gr.owner_id
  )
  select
    sp.id as profile_id,
    mel.max_clients,
    coalesce(cc.current_clients, 0) as current_clients,
    mel.default_client_output_limit,
    cel.output_limit as client_output_limit,
    coalesce(cel.output_limit, mel2.default_client_output_limit) as effective_output_limit,
    coalesce(doa.output_used, 0) as output_used_today,
    case
      when coalesce(cel.output_limit, mel2.default_client_output_limit) is null then null
      else greatest(coalesce(cel.output_limit, mel2.default_client_output_limit) - coalesce(doa.output_used, 0), 0)
    end as output_remaining_today,
    (select max(value) from (values (cel.updated_at), (mel.updated_at), (mel2.updated_at)) as update_values(value)) as updated_at
  from selected_profiles sp
  left join public.manager_entitlement_limits mel on mel.manager_id = sp.id
  left join client_counts cc on cc.manager_id = sp.id
  left join public.client_entitlement_limits cel on cel.client_id = sp.id
  left join primary_assignments pa on pa.client_id = sp.id
  left join public.manager_entitlement_limits mel2 on mel2.manager_id = coalesce(pa.manager_id, sp.manager_id, cel.manager_id)
  left join daily_outputs doa on doa.owner_id = sp.id;
end;
$$;

grant execute on function public.access_list_daily_entitlement_limits_v1(uuid[]) to authenticated;

create or replace function public.access_workspace_manager_suspend_v1(target_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  target_profile public.profiles;
  assignment_record public.client_manager_assignments;
  assignment_id_value uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  workspace_id_value := public.access_default_workspace_id();
  perform public.access_ensure_default_workspace_membership(auth.uid());
  perform public.access_ensure_default_workspace_membership(target_profile_id);
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value <> 'manager' then
    raise exception 'Only a workspace manager can pause a Disputer.';
  end if;

  select p.* into target_profile from public.profiles p where p.id = target_profile_id;
  if target_profile.id is null or target_profile.role::text <> 'client' then
    raise exception 'Target account is not a client profile.';
  end if;

  select ca.* into assignment_record
  from public.client_manager_assignments ca
  where ca.workspace_id = workspace_id_value
    and ca.client_id = target_profile_id
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and ca.manager_id = auth.uid()
  order by case when ca.assignment_status = 'active' then 0 else 1 end, ca.created_at desc nulls last
  limit 1;

  if assignment_record.id is null and target_profile.manager_id = auth.uid() then
    insert into public.client_manager_assignments (
      workspace_id, client_id, manager_id, assignment_role, assignment_status,
      requested_by, assigned_by, approved_by, approved_at, metadata_json
    )
    values (
      workspace_id_value, target_profile_id, auth.uid(), 'primary', 'active',
      target_profile_id, auth.uid(), auth.uid(), now(),
      jsonb_build_object('phase', 'output_limit_sync_pause', 'source', 'lazy_pause_backfill')
    )
    returning id into assignment_id_value;

    select ca.* into assignment_record
    from public.client_manager_assignments ca
    where ca.id = assignment_id_value;
  end if;

  if assignment_record.id is null then
    raise exception 'Client is not assigned to this manager.';
  end if;

  update public.profiles
  set account_status = 'suspended'::public.account_status,
      manager_id = auth.uid(),
      updated_at = now()
  where id = target_profile_id;

  update public.workspace_members
  set membership_status = 'suspended',
      updated_at = now()
  where workspace_id = workspace_id_value
    and profile_id = target_profile_id;

  update public.client_entitlement_limits
  set manager_id = auth.uid(),
      updated_at = now()
  where client_id = target_profile_id;

  perform public.access_log_assignment_event(
    assignment_record.id,
    workspace_id_value,
    target_profile_id,
    auth.uid(),
    'manager_paused_client',
    target_profile.account_status::text,
    'suspended',
    jsonb_build_object('phase', 'output_limit_sync_pause')
  );

  return true;
end;
$$;

grant execute on function public.access_workspace_manager_suspend_v1(uuid) to authenticated;

create or replace function public.access_sync_client_entitlement_manager_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client_id uuid;
begin
  if TG_OP <> 'DELETE'
     and new.assignment_role = 'primary'
     and new.assignment_status in ('active', 'pending') then
    update public.client_entitlement_limits
    set manager_id = new.manager_id,
        updated_at = now()
    where client_id = new.client_id;
    return new;
  end if;

  target_client_id := case when TG_OP = 'DELETE' then old.client_id else old.client_id end;

  if target_client_id is not null then
    update public.client_entitlement_limits
    set manager_id = public.access_current_client_manager_id_v1(target_client_id),
        updated_at = now()
    where client_id = target_client_id;
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_access_sync_client_entitlement_manager on public.client_manager_assignments;
create trigger trg_access_sync_client_entitlement_manager
after insert or delete or update of manager_id, assignment_status, assignment_role
on public.client_manager_assignments
for each row execute function public.access_sync_client_entitlement_manager_v1();

with current_manager as (
  select cel.client_id, public.access_current_client_manager_id_v1(cel.client_id) as manager_id
  from public.client_entitlement_limits cel
)
update public.client_entitlement_limits cel
set manager_id = cm.manager_id,
    updated_at = now()
from current_manager cm
where cel.client_id = cm.client_id
  and cel.manager_id is distinct from cm.manager_id;

notify pgrst, 'reload schema';
