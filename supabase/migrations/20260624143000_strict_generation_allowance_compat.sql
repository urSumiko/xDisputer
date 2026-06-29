-- Strict generation allowance compatibility
-- Fixes runtime error:
--   function public.access_generation_run_counts_as_output(text) does not exist
-- Also makes Disputer generation allowance a strict Master-manager-limit gate.

create or replace function public.access_generation_run_counts_as_output(output_status_input text)
returns boolean
language sql
immutable
as $$
  select coalesce(nullif(lower(output_status_input), ''), 'generated') not in ('failed', 'error', 'cancelled', 'canceled');
$$;

grant execute on function public.access_generation_run_counts_as_output(text) to authenticated;
grant execute on function public.access_generation_run_counts_as_output(text) to service_role;

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
    (manager_id_value is not null and limit_value is not null and used_value < limit_value) as allowed,
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
grant execute on function public.access_client_daily_output_entitlement_v1(uuid) to service_role;

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
grant execute on function public.access_check_generation_output_limit_v1(uuid) to service_role;

create or replace function public.access_assert_client_can_generate_v1(owner_id_input uuid default auth.uid())
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
begin
  return query
  select
    d.allowed,
    d.output_limit,
    d.output_used_today,
    d.output_remaining_today,
    d.reset_at,
    d.reset_seconds,
    coalesce(d.message, case when d.allowed then null else 'Daily output allowance is blocked.' end) as message
  from public.access_client_daily_output_entitlement_v1(owner_id_input) d;
end;
$$;

grant execute on function public.access_assert_client_can_generate_v1(uuid) to authenticated;
grant execute on function public.access_assert_client_can_generate_v1(uuid) to service_role;

notify pgrst, 'reload schema';
