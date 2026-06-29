-- Live entitlement limit sync repair.
-- Root cause fixed: blank limit inputs were normalized into 0 by GREATEST(NULL, 0),
-- and client pause UI had no canonical DB-side function that preserved NULL as inherited/unlimited.

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
    case when max_clients_input is null then null else greatest(max_clients_input, 0) end,
    case when default_client_output_limit_input is null then null else greatest(default_client_output_limit_input, 0) end,
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
    case when output_limit_input is null then null else greatest(output_limit_input, 0) end,
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
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

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
    and gr.created_at >= public.access_us_eastern_day_start()
    and gr.created_at < public.access_us_eastern_next_day_start()
    and gr.output_status in ('generated', 'downloaded');

  return query select
    (limit_value is null or used_value < limit_value) as allowed,
    limit_value as output_limit,
    used_value as output_used_today,
    case when limit_value is null then null else greatest(limit_value - used_value, 0) end as output_remaining_today,
    public.access_us_eastern_next_day_start() as reset_at,
    greatest(extract(epoch from (public.access_us_eastern_next_day_start() - now()))::integer, 0) as reset_seconds,
    case
      when limit_value is null or used_value < limit_value then null
      else 'Daily output limit reached. Your workspace unlocks when the master increases the limit or at the next US Eastern day reset.'
    end as message;
end;
$$;

grant execute on function public.access_client_daily_output_entitlement_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
