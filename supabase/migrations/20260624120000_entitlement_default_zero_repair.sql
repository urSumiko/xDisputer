-- Entitlement default/zero repair
-- Default contract:
--   NULL means default/unlimited/inherit.
--   Positive whole numbers are hard caps.
--   0 is treated as legacy bad data and repaired back to NULL.

create or replace function public.access_limit_or_null_v1(limit_input integer)
returns integer
language sql
immutable
as $$
  select case when limit_input is null or limit_input <= 0 then null else limit_input end;
$$;

grant execute on function public.access_limit_or_null_v1(integer) to authenticated;

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
    select 1
    from public.profiles p
    where p.id = manager_id_input
      and p.role::text in ('admin', 'manager')
  ) then
    raise exception 'Target account is not a manager.';
  end if;

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
    public.access_limit_or_null_v1(max_clients_input),
    public.access_limit_or_null_v1(default_client_output_limit_input),
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
    public.access_limit_or_null_v1(output_limit_input),
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

update public.manager_entitlement_limits
set max_clients = null,
    updated_at = now()
where max_clients is not null
  and max_clients <= 0;

update public.manager_entitlement_limits
set default_client_output_limit = null,
    updated_at = now()
where default_client_output_limit is not null
  and default_client_output_limit <= 0;

update public.client_entitlement_limits
set output_limit = null,
    updated_at = now()
where output_limit is not null
  and output_limit <= 0;

notify pgrst, 'reload schema';
