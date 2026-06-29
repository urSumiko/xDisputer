-- Make the entitlement manager sync trigger safe for INSERT rows that are not active/pending primary assignments.

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

  if TG_OP = 'UPDATE' or TG_OP = 'DELETE' then
    target_client_id := old.client_id;
  else
    return new;
  end if;

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

notify pgrst, 'reload schema';
