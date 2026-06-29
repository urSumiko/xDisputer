-- Master authority required limit contract
-- Master is source of truth.
-- Manager max Disputers and manager default outputs per Disputer/day must be positive numbers.
-- Disputer-specific output limit is optional and can be NULL to inherit the manager cap.
-- Missing manager output cap blocks Disputer generation until Master configures it.

create or replace function public.access_positive_limit_required_v1(limit_input integer, label_input text)
returns integer
language plpgsql
immutable
as $$
begin
  if limit_input is null or limit_input <= 0 then
    raise exception '% must be a positive whole number set by Master.', coalesce(label_input, 'Limit');
  end if;

  return limit_input;
end;
$$;

grant execute on function public.access_positive_limit_required_v1(integer, text) to authenticated;

create or replace function public.access_optional_positive_limit_v1(limit_input integer)
returns integer
language sql
immutable
as $$
  select case when limit_input is null or limit_input <= 0 then null else limit_input end;
$$;

grant execute on function public.access_optional_positive_limit_v1(integer) to authenticated;

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
declare
  max_clients_value integer;
  default_output_value integer;
begin
  if auth.uid() is null or not public.access_is_master(auth.uid()) then
    raise exception 'Only master can edit manager limits.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = manager_id_input
      and p.role::text in ('admin', 'manager')
  ) then
    raise exception 'Target account is not a manager.';
  end if;

  max_clients_value := public.access_positive_limit_required_v1(max_clients_input, 'Manager Disputer limit');
  default_output_value := public.access_positive_limit_required_v1(default_client_output_limit_input, 'Manager default outputs per Disputer/day');

  insert into public.manager_entitlement_limits(
    manager_id,
    max_clients,
    default_client_output_limit,
    notes,
    updated_by,
    updated_at
  )
  values (
    manager_id_input,
    max_clients_value,
    default_output_value,
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
    select 1
    from public.profiles p
    where p.id = client_id_input
      and p.role::text = 'client'
  ) then
    raise exception 'Target account is not a client.';
  end if;

  manager_id_value := public.access_current_client_manager_id_v1(client_id_input);

  insert into public.client_entitlement_limits(
    client_id,
    manager_id,
    output_limit,
    notes,
    updated_by,
    updated_at
  )
  values (
    client_id_input,
    manager_id_value,
    public.access_optional_positive_limit_v1(output_limit_input),
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
  select mel.max_clients
  into max_clients_value
  from public.manager_entitlement_limits mel
  where mel.manager_id = manager_id_input
    and mel.max_clients > 0;

  select count(distinct ca.client_id)::integer
  into current_clients_value
  from public.client_manager_assignments ca
  join public.profiles cp on cp.id = ca.client_id
  where ca.manager_id = manager_id_input
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and coalesce(cp.account_status::text, 'active') not in ('disabled', 'suspended');

  return query select
    (max_clients_value is not null and current_clients_value < max_clients_value) as allowed,
    max_clients_value,
    current_clients_value,
    case when max_clients_value is null then null else greatest(max_clients_value - current_clients_value, 0) end as remaining_clients,
    case
      when max_clients_value is null then 'Master must set this manager Disputer limit before assigning more Disputers.'
      when current_clients_value < max_clients_value then null
      else 'Manager Disputer limit reached. Ask Master to increase this manager agreement limit.'
    end as message;
end;
$$;

grant execute on function public.access_check_manager_client_limit_v1(uuid) to authenticated;

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

  select p.role::text
  into actor_role_value
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

  select coalesce(nullif(cel.output_limit, 0), nullif(mel.default_client_output_limit, 0))
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
    (limit_value is not null and used_value < limit_value) as allowed,
    limit_value as output_limit,
    used_value as output_used_today,
    case when limit_value is null then null else greatest(limit_value - used_value, 0) end as output_remaining_today,
    public.access_us_eastern_next_day_start() as reset_at,
    greatest(extract(epoch from (public.access_us_eastern_next_day_start() - now()))::integer, 0) as reset_seconds,
    case
      when limit_value is null then 'Master must set this manager daily output limit before this Disputer can generate output.'
      when used_value < limit_value then null
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
    nullif(mel.max_clients, 0) as max_clients,
    coalesce(cc.current_clients, 0) as current_clients,
    nullif(mel.default_client_output_limit, 0) as default_client_output_limit,
    nullif(cel.output_limit, 0) as client_output_limit,
    coalesce(nullif(cel.output_limit, 0), nullif(mel2.default_client_output_limit, 0)) as effective_output_limit,
    coalesce(doa.output_used, 0) as output_used_today,
    case
      when coalesce(nullif(cel.output_limit, 0), nullif(mel2.default_client_output_limit, 0)) is null then null
      else greatest(coalesce(nullif(cel.output_limit, 0), nullif(mel2.default_client_output_limit, 0)) - coalesce(doa.output_used, 0), 0)
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

notify pgrst, 'reload schema';
