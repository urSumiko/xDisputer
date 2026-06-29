-- Phase 13 — Daily output entitlement reset
-- Purpose:
--   - Change client output usage from monthly-style counting to daily counting.
--   - Use the US Eastern calendar date as the reset boundary.
--   - Keep manager/client limits master-controlled and Supabase-enforced.

create or replace function public.access_us_eastern_day_start()
returns timestamptz
language sql
stable
as $$
  select ((now() at time zone 'America/New_York')::date at time zone 'America/New_York');
$$;

create or replace function public.access_client_successful_output_count(client_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.generation_runs gr
  where gr.owner_id = client_id_input
    and coalesce(gr.output_status, 'generated') in ('generated', 'downloaded')
    and gr.created_at >= public.access_us_eastern_day_start()
    and gr.created_at < public.access_us_eastern_day_start() + interval '1 day';
$$;

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

  if actor_role_value not in ('master', 'manager') then
    raise exception 'Only master or manager accounts can view entitlement limits.';
  end if;

  return query
  select
    p.id as profile_id,
    s.manager_client_limit as max_clients,
    public.access_manager_active_client_count(p.id) as current_clients,
    s.default_client_output_limit,
    s.client_output_limit,
    public.access_effective_client_output_limit(p.id) as effective_output_limit,
    public.access_client_successful_output_count(p.id) as output_used_today,
    greatest(public.access_effective_client_output_limit(p.id) - public.access_client_successful_output_count(p.id), 0) as output_remaining_today,
    s.updated_at
  from public.profiles p
  left join public.account_limit_settings s on s.profile_id = p.id
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
    );
end;
$$;

grant execute on function public.access_list_daily_entitlement_limits_v1(uuid[]) to authenticated;

notify pgrst, 'reload schema';
