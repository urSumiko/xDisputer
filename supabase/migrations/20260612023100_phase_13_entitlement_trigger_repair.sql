-- Phase 13 repair — make manager client-limit trigger safe for updates.
-- Excludes the row being updated when checking whether a manager has capacity.

create or replace function public.access_enforce_manager_client_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_clients_value integer;
  current_clients_value integer;
begin
  if new.assignment_role = 'primary'
     and new.assignment_status in ('pending', 'active')
     and new.manager_id is not null then

    select mel.max_clients
    into max_clients_value
    from public.manager_entitlement_limits mel
    where mel.manager_id = new.manager_id;

    if max_clients_value is not null then
      select count(distinct ca.client_id)::integer
      into current_clients_value
      from public.client_manager_assignments ca
      join public.profiles cp on cp.id = ca.client_id
      where ca.manager_id = new.manager_id
        and ca.assignment_role = 'primary'
        and ca.assignment_status in ('pending', 'active')
        and coalesce(cp.account_status::text, 'active') not in ('disabled', 'suspended')
        and ca.client_id <> new.client_id;

      if current_clients_value >= max_clients_value then
        raise exception 'Manager client limit reached. Ask master to increase this manager agreement limit.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
