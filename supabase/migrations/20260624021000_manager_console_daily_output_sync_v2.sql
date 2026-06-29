-- Manager console daily output sync v2
-- Purpose:
--   Keep manager reports, account cards, and workspace entitlement checks on the same daily counter.
--   Count successful generation runs for the current US Eastern day, including legacy rows with null/success/completed status.
--   Do not count failed/error/cancelled rows.

create or replace function public.access_us_eastern_day_start()
returns timestamptz
language sql
stable
as $$
  select ((now() at time zone 'America/New_York')::date at time zone 'America/New_York');
$$;

create or replace function public.access_us_eastern_next_day_start()
returns timestamptz
language sql
stable
as $$
  select public.access_us_eastern_day_start() + interval '1 day';
$$;

create or replace function public.access_generation_run_counts_as_output(output_status_input text)
returns boolean
language sql
immutable
as $$
  select coalesce(nullif(lower(output_status_input), ''), 'generated') not in ('failed', 'error', 'cancelled', 'canceled');
$$;

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

grant execute on function public.access_generation_run_counts_as_output(text) to authenticated;
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
  select
    d.allowed,
    d.output_limit,
    d.output_used_today as output_used_this_month,
    d.output_remaining_today as output_remaining_this_month,
    d.message
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
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

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
          select 1
          from public.client_manager_assignments ca
          where ca.client_id = p.id
            and ca.manager_id = auth.uid()
            and ca.assignment_status in ('pending', 'active')
        )
      )
  ), primary_assignments as (
    select distinct on (ca.client_id)
      ca.client_id,
      ca.manager_id
    from public.client_manager_assignments ca
    where ca.assignment_role = 'primary'
      and ca.assignment_status in ('pending', 'active')
    order by ca.client_id, ca.created_at desc nulls last
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
    coalesce(cel.updated_at, mel.updated_at, mel2.updated_at) as updated_at
  from selected_profiles sp
  left join public.manager_entitlement_limits mel on mel.manager_id = sp.id
  left join client_counts cc on cc.manager_id = sp.id
  left join public.client_entitlement_limits cel on cel.client_id = sp.id
  left join primary_assignments pa on pa.client_id = sp.id
  left join public.manager_entitlement_limits mel2 on mel2.manager_id = coalesce(cel.manager_id, pa.manager_id, sp.manager_id)
  left join daily_outputs doa on doa.owner_id = sp.id;
end;
$$;

grant execute on function public.access_list_daily_entitlement_limits_v1(uuid[]) to authenticated;

notify pgrst, 'reload schema';
