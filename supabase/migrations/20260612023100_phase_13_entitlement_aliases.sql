-- Phase 13 — Entitlement RPC compatibility for master UI
-- Depends on: 20260612023000_phase_13_account_limits.sql
-- Purpose:
--   - Provide the RPC names used by the master entitlement UI.
--   - Add manager default output limits and agreement notes.
--   - Keep the database enforcement triggers as the final gate.

alter table public.account_limit_settings
  add column if not exists default_client_output_limit integer,
  add column if not exists entitlement_notes text;

alter table public.account_limit_settings
  drop constraint if exists account_limit_settings_default_output_limit_check;

alter table public.account_limit_settings
  add constraint account_limit_settings_default_output_limit_check
  check (default_client_output_limit is null or default_client_output_limit >= 0);

create or replace function public.access_effective_client_output_limit(client_id_input uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select client_setting.client_output_limit
     from public.account_limit_settings client_setting
     where client_setting.profile_id = client_id_input),
    (select manager_setting.default_client_output_limit
     from public.profiles client_profile
     join public.account_limit_settings manager_setting on manager_setting.profile_id = client_profile.manager_id
     where client_profile.id = client_id_input),
    public.access_default_client_output_limit()
  );
$$;

create or replace function public.access_list_entitlement_limits_v1(profile_ids uuid[] default null)
returns table (
  profile_id uuid,
  max_clients integer,
  current_clients integer,
  default_client_output_limit integer,
  client_output_limit integer,
  effective_output_limit integer,
  output_used_this_month integer,
  output_remaining_this_month integer,
  entitlement_notes text,
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
    public.access_client_successful_output_count(p.id) as output_used_this_month,
    greatest(public.access_effective_client_output_limit(p.id) - public.access_client_successful_output_count(p.id), 0) as output_remaining_this_month,
    s.entitlement_notes,
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

grant execute on function public.access_list_entitlement_limits_v1(uuid[]) to authenticated;

create or replace function public.access_set_manager_entitlement_v1(
  manager_id_input uuid,
  max_clients_input integer default null,
  default_client_output_limit_input integer default null,
  notes_input text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
  target_role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select role::text into actor_role_value from public.profiles where id = auth.uid();
  if actor_role_value <> 'master' then
    raise exception 'Only master can edit manager entitlement limits.';
  end if;

  select role::text into target_role_value from public.profiles where id = manager_id_input;
  if target_role_value not in ('manager', 'admin') then
    raise exception 'Target account is not a manager.';
  end if;

  if max_clients_input is not null and max_clients_input < 0 then
    raise exception 'Client limit cannot be negative.';
  end if;

  if default_client_output_limit_input is not null and default_client_output_limit_input < 0 then
    raise exception 'Default output limit cannot be negative.';
  end if;

  insert into public.account_limit_settings (
    profile_id,
    manager_client_limit,
    default_client_output_limit,
    entitlement_notes,
    updated_by,
    updated_at
  ) values (
    manager_id_input,
    max_clients_input,
    default_client_output_limit_input,
    nullif(left(coalesce(notes_input, ''), 300), ''),
    auth.uid(),
    now()
  )
  on conflict (profile_id) do update
  set manager_client_limit = max_clients_input,
      default_client_output_limit = default_client_output_limit_input,
      entitlement_notes = nullif(left(coalesce(notes_input, ''), 300), ''),
      updated_by = auth.uid(),
      updated_at = now();

  return true;
end;
$$;

grant execute on function public.access_set_manager_entitlement_v1(uuid, integer, integer, text) to authenticated;

create or replace function public.access_set_client_entitlement_v1(
  client_id_input uuid,
  output_limit_input integer default null,
  notes_input text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value text;
  target_role_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select role::text into actor_role_value from public.profiles where id = auth.uid();
  if actor_role_value <> 'master' then
    raise exception 'Only master can edit client entitlement limits.';
  end if;

  select role::text into target_role_value from public.profiles where id = client_id_input;
  if target_role_value <> 'client' then
    raise exception 'Target account is not a client.';
  end if;

  if output_limit_input is not null and output_limit_input < 0 then
    raise exception 'Output limit cannot be negative.';
  end if;

  insert into public.account_limit_settings (
    profile_id,
    client_output_limit,
    entitlement_notes,
    updated_by,
    updated_at
  ) values (
    client_id_input,
    output_limit_input,
    nullif(left(coalesce(notes_input, ''), 300), ''),
    auth.uid(),
    now()
  )
  on conflict (profile_id) do update
  set client_output_limit = output_limit_input,
      entitlement_notes = nullif(left(coalesce(notes_input, ''), 300), ''),
      updated_by = auth.uid(),
      updated_at = now();

  return true;
end;
$$;

grant execute on function public.access_set_client_entitlement_v1(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
