-- Manager-only Disputer output entitlement contract
-- Master sets limits only on /master/accounts?view=managers.
-- Disputers inherit the assigned manager default_client_output_limit.
-- Old per-Disputer output overrides are ignored for generation allowance.

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

  select nullif(mel.default_client_output_limit, 0)
  into limit_value
  from public.manager_entitlement_limits mel
  where mel.manager_id = manager_id_value;

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
      when manager_id_value is null then 'This Disputer needs a boss manager assignment before generation can open.'
      when limit_value is null then 'Master must set this manager daily output limit before this Disputer can generate output.'
      when used_value < limit_value then null
      else 'Daily output limit reached. This Disputer allowance resets at the next US Eastern day.'
    end as message;
end;
$$;

grant execute on function public.access_client_daily_output_entitlement_v1(uuid) to authenticated;

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
    null::integer as client_output_limit,
    case
      when sp.role in ('manager', 'admin') then nullif(mel.default_client_output_limit, 0)
      else nullif(mel2.default_client_output_limit, 0)
    end as effective_output_limit,
    coalesce(doa.output_used, 0) as output_used_today,
    case
      when (case when sp.role in ('manager', 'admin') then nullif(mel.default_client_output_limit, 0) else nullif(mel2.default_client_output_limit, 0) end) is null then null
      else greatest((case when sp.role in ('manager', 'admin') then nullif(mel.default_client_output_limit, 0) else nullif(mel2.default_client_output_limit, 0) end) - coalesce(doa.output_used, 0), 0)
    end as output_remaining_today,
    (select max(value) from (values (mel.updated_at), (mel2.updated_at)) as update_values(value)) as updated_at
  from selected_profiles sp
  left join public.manager_entitlement_limits mel on mel.manager_id = sp.id
  left join client_counts cc on cc.manager_id = sp.id
  left join primary_assignments pa on pa.client_id = sp.id
  left join public.manager_entitlement_limits mel2 on mel2.manager_id = coalesce(pa.manager_id, sp.manager_id)
  left join daily_outputs doa on doa.owner_id = sp.id;
end;
$$;

grant execute on function public.access_list_daily_entitlement_limits_v1(uuid[]) to authenticated;

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
begin
  if auth.uid() is null or not public.access_is_master(auth.uid()) then
    raise exception 'Only master can edit limits.';
  end if;

  raise exception 'Per-Disputer output overrides are retired. Set the manager default output cap in /master/accounts?view=managers.';
end;
$$;

grant execute on function public.access_set_client_entitlement_v1(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
