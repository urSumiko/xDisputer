-- Client-visible payroll profile contract for generation intent.
-- Clients need to know whether their manager profile is full-time or per-output before generation.
-- This RPC only returns the current authenticated user's own payroll type and rates.

create or replace function public.client_payroll_profile_v1()
returns table (
  employment_type text,
  is_output_based boolean,
  is_full_time boolean,
  base_salary numeric,
  per_output_rate numeric,
  manager_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile record;
  setting record;
begin
  select id, manager_id
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    return;
  end if;

  if current_profile.manager_id is not null then
    select employment_type, is_regular, base_salary, salary, per_output_rate, rate, updated_at
    into setting
    from public.manager_user_settings
    where manager_id = current_profile.manager_id
      and user_id = current_profile.id;
  end if;

  return query select
    case
      when coalesce(setting.employment_type, case when coalesce(setting.is_regular, true) then 'full_time' else 'output_based' end) = 'output_based'
        or coalesce(setting.is_regular, true) = false
      then 'output_based'
      else 'full_time'
    end::text as employment_type,
    (
      coalesce(setting.employment_type, case when coalesce(setting.is_regular, true) then 'full_time' else 'output_based' end) = 'output_based'
      or coalesce(setting.is_regular, true) = false
    )::boolean as is_output_based,
    not (
      coalesce(setting.employment_type, case when coalesce(setting.is_regular, true) then 'full_time' else 'output_based' end) = 'output_based'
      or coalesce(setting.is_regular, true) = false
    )::boolean as is_full_time,
    case
      when coalesce(setting.employment_type, case when coalesce(setting.is_regular, true) then 'full_time' else 'output_based' end) = 'output_based'
        or coalesce(setting.is_regular, true) = false
      then 0::numeric
      else coalesce(setting.base_salary, setting.salary, 0)::numeric
    end as base_salary,
    coalesce(setting.per_output_rate, setting.rate, 0)::numeric as per_output_rate,
    current_profile.manager_id as manager_id,
    setting.updated_at as updated_at;
end;
$$;

grant execute on function public.client_payroll_profile_v1() to authenticated;

notify pgrst, 'reload schema';
