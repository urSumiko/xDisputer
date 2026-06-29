create or replace function public.client_payroll_profile_v1()
returns table(
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
  resolved_employment_type text;
  resolved_is_output_based boolean;
begin
  select p.id, p.manager_id
  into current_profile
  from public.profiles p
  where p.id = auth.uid();

  if current_profile.id is null then
    return;
  end if;

  if current_profile.manager_id is not null then
    select
      mus.employment_type,
      mus.is_regular,
      mus.base_salary,
      mus.salary,
      mus.per_output_rate,
      mus.rate,
      mus.updated_at
    into setting
    from public.manager_user_settings mus
    where mus.manager_id = current_profile.manager_id
      and mus.user_id = current_profile.id
    order by mus.updated_at desc nulls last
    limit 1;
  end if;

  resolved_is_output_based := (
    coalesce(setting.employment_type, case when coalesce(setting.is_regular, true) then 'full_time' else 'output_based' end) = 'output_based'
    or coalesce(setting.is_regular, true) = false
  );

  resolved_employment_type := case when resolved_is_output_based then 'output_based' else 'full_time' end;

  return query select
    resolved_employment_type::text,
    resolved_is_output_based::boolean,
    (not resolved_is_output_based)::boolean,
    case when resolved_is_output_based then 0::numeric else coalesce(setting.base_salary, setting.salary, 0)::numeric end,
    coalesce(setting.per_output_rate, setting.rate, 0)::numeric,
    current_profile.manager_id::uuid,
    setting.updated_at::timestamptz;
end;
$$;

grant execute on function public.client_payroll_profile_v1() to authenticated;
