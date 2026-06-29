-- Phase 11D/11E — Workspace ledger control adoption
-- Purpose:
--   - Route approve/reject/disable/reactivate/clear-manager actions through the workspace assignment ledger.
--   - Keep profiles.manager_id as compatibility pointer.
--   - Preserve existing output generation behavior.
--
-- Safety:
--   - Additive RPC layer with *_v1 names.
--   - No quota enforcement.
--   - No generated-output changes.
--   - Existing pages can fall back to old RPCs if this SQL has not been deployed yet.

create extension if not exists pgcrypto;

drop function if exists public.access_workspace_manager_control_v1(uuid, text);
drop function if exists public.access_workspace_master_control_v1(uuid, text);

-- ============================================================
-- Manager control: client actions scoped by workspace assignment
-- ============================================================

create or replace function public.access_workspace_manager_control_v1(
  target_profile_id uuid,
  control_intent text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_role_value text;
  target_profile public.profiles;
  assignment_record public.client_manager_assignments;
  assignment_id_value uuid;
  normalized_intent text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  workspace_id_value := public.access_default_workspace_id();
  perform public.access_ensure_default_workspace_membership(auth.uid());
  perform public.access_ensure_default_workspace_membership(target_profile_id);
  actor_role_value := public.access_actor_workspace_role(workspace_id_value, auth.uid());

  if actor_role_value <> 'manager' then
    raise exception 'Only a workspace manager can perform manager control actions.';
  end if;

  normalized_intent := case when control_intent = 'reactivate' then 'activate' else control_intent end;

  if normalized_intent not in ('approve', 'reject', 'disable', 'activate', 'clear_manager') then
    raise exception 'Unsupported manager control intent.';
  end if;

  select p.*
  into target_profile
  from public.profiles p
  where p.id = target_profile_id;

  if target_profile.id is null or target_profile.role::text <> 'client' then
    raise exception 'Target account is not a client profile.';
  end if;

  select ca.*
  into assignment_record
  from public.client_manager_assignments ca
  where ca.workspace_id = workspace_id_value
    and ca.client_id = target_profile_id
    and ca.assignment_role = 'primary'
    and ca.assignment_status in ('pending', 'active')
    and ca.manager_id = auth.uid()
  order by ca.created_at desc
  limit 1;

  -- If a legacy client has profiles.manager_id but no ledger row yet, create the ledger row lazily.
  if assignment_record.id is null and target_profile.manager_id = auth.uid() then
    insert into public.client_manager_assignments (
      workspace_id,
      client_id,
      manager_id,
      assignment_role,
      assignment_status,
      requested_by,
      assigned_by,
      approved_by,
      approved_at,
      metadata_json
    )
    values (
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      'primary',
      case when target_profile.account_status::text = 'pending_manager_approval' then 'pending' else 'active' end,
      target_profile_id,
      auth.uid(),
      case when target_profile.account_status::text = 'pending_manager_approval' then null else auth.uid() end,
      case when target_profile.account_status::text = 'pending_manager_approval' then null else now() end,
      jsonb_build_object('phase', '11D', 'source', 'lazy_manager_control_backfill')
    )
    returning id into assignment_id_value;

    perform public.access_log_assignment_event(
      assignment_id_value,
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      'lazy_backfilled_from_profiles_manager_id',
      null,
      case when target_profile.account_status::text = 'pending_manager_approval' then 'pending' else 'active' end,
      jsonb_build_object('phase', '11D')
    );

    select ca.*
    into assignment_record
    from public.client_manager_assignments ca
    where ca.id = assignment_id_value;
  end if;

  if assignment_record.id is null then
    raise exception 'Client is not assigned to this manager.';
  end if;

  if normalized_intent = 'approve' then
    update public.client_manager_assignments
    set assignment_status = 'active',
        approved_by = auth.uid(),
        approved_at = coalesce(approved_at, now())
    where id = assignment_record.id;

    update public.profiles
    set manager_id = auth.uid(),
        account_status = 'active'::public.account_status,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = 'active',
        joined_at = coalesce(joined_at, now()),
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    perform public.access_log_assignment_event(
      assignment_record.id,
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      'manager_approved_client',
      assignment_record.assignment_status,
      'active',
      jsonb_build_object('phase', '11D')
    );

    return true;
  end if;

  if normalized_intent = 'reject' or normalized_intent = 'clear_manager' then
    update public.client_manager_assignments
    set assignment_status = 'revoked',
        revoked_by = auth.uid(),
        revoked_at = now()
    where id = assignment_record.id;

    update public.profiles
    set manager_id = null,
        account_status = case
          when account_status::text = 'disabled' then account_status
          else 'pending_manager_assignment'::public.account_status
        end,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = case
          when membership_status = 'disabled' then membership_status
          else 'pending'
        end,
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    perform public.access_log_assignment_event(
      assignment_record.id,
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      case when normalized_intent = 'reject' then 'manager_rejected_client' else 'manager_cleared_client_manager' end,
      assignment_record.assignment_status,
      'revoked',
      jsonb_build_object('phase', '11D')
    );

    return true;
  end if;

  if normalized_intent = 'disable' then
    update public.profiles
    set account_status = 'disabled'::public.account_status,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = 'disabled',
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    perform public.access_log_assignment_event(
      assignment_record.id,
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      'manager_disabled_client',
      target_profile.account_status::text,
      'disabled',
      jsonb_build_object('phase', '11D')
    );

    return true;
  end if;

  if normalized_intent = 'activate' then
    update public.client_manager_assignments
    set assignment_status = 'active',
        approved_by = coalesce(approved_by, auth.uid()),
        approved_at = coalesce(approved_at, now())
    where id = assignment_record.id;

    update public.profiles
    set manager_id = auth.uid(),
        account_status = 'active'::public.account_status,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = 'active',
        joined_at = coalesce(joined_at, now()),
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    perform public.access_log_assignment_event(
      assignment_record.id,
      workspace_id_value,
      target_profile_id,
      auth.uid(),
      'manager_activated_client',
      target_profile.account_status::text,
      'active',
      jsonb_build_object('phase', '11D')
    );

    return true;
  end if;

  raise exception 'Unsupported manager control intent.';
end;
$$;

grant execute on function public.access_workspace_manager_control_v1(uuid, text) to authenticated;

-- ============================================================
-- Master control: account actions synced with workspace membership/ledger
-- ============================================================

create or replace function public.access_workspace_master_control_v1(
  target_profile_id uuid,
  control_intent text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id_value uuid;
  actor_profile public.profiles;
  target_profile public.profiles;
  normalized_intent text;
  assignment_record public.client_manager_assignments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select p.*
  into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.role::text <> 'master' then
    raise exception 'Only master can perform master workspace controls.';
  end if;

  workspace_id_value := public.access_default_workspace_id();
  normalized_intent := case when control_intent = 'reactivate' then 'activate' else control_intent end;

  if normalized_intent not in ('make_manager', 'demote_client', 'disable', 'suspend', 'activate', 'clear_manager') then
    raise exception 'Unsupported master control intent.';
  end if;

  select p.*
  into target_profile
  from public.profiles p
  where p.id = target_profile_id;

  if target_profile.id is null then
    raise exception 'Target profile not found.';
  end if;

  perform public.access_ensure_default_workspace_membership(target_profile_id);

  if normalized_intent = 'make_manager' then
    -- A promoted account can no longer be treated as a managed client.
    for assignment_record in
      select ca.*
      from public.client_manager_assignments ca
      where ca.workspace_id = workspace_id_value
        and ca.client_id = target_profile_id
        and ca.assignment_status in ('pending', 'active')
    loop
      update public.client_manager_assignments
      set assignment_status = 'revoked',
          revoked_by = auth.uid(),
          revoked_at = now()
      where id = assignment_record.id;

      perform public.access_log_assignment_event(
        assignment_record.id,
        workspace_id_value,
        target_profile_id,
        assignment_record.manager_id,
        'master_revoked_client_assignment_for_promotion',
        assignment_record.assignment_status,
        'revoked',
        jsonb_build_object('phase', '11D')
      );
    end loop;

    update public.profiles
    set role = 'manager',
        account_status = 'active'::public.account_status,
        manager_id = null,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set member_role = 'manager',
        member_scope = 'workspace',
        membership_status = 'active',
        joined_at = coalesce(joined_at, now()),
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    return true;
  end if;

  if normalized_intent = 'demote_client' then
    -- If a manager is demoted, their active clients become unassigned instead of silently staying attached.
    for assignment_record in
      select ca.*
      from public.client_manager_assignments ca
      where ca.workspace_id = workspace_id_value
        and ca.manager_id = target_profile_id
        and ca.assignment_status in ('pending', 'active')
    loop
      update public.client_manager_assignments
      set assignment_status = 'revoked',
          revoked_by = auth.uid(),
          revoked_at = now()
      where id = assignment_record.id;

      update public.profiles
      set manager_id = null,
          account_status = case
            when account_status::text = 'disabled' then account_status
            else 'pending_manager_assignment'::public.account_status
          end,
          updated_at = now()
      where id = assignment_record.client_id;

      update public.workspace_members
      set membership_status = case
            when membership_status = 'disabled' then membership_status
            else 'pending'
          end,
          updated_at = now()
      where workspace_id = workspace_id_value
        and profile_id = assignment_record.client_id;

      perform public.access_log_assignment_event(
        assignment_record.id,
        workspace_id_value,
        assignment_record.client_id,
        target_profile_id,
        'master_revoked_assignment_for_manager_demotion',
        assignment_record.assignment_status,
        'revoked',
        jsonb_build_object('phase', '11D')
      );
    end loop;

    update public.profiles
    set role = 'client',
        account_status = 'pending_manager_assignment'::public.account_status,
        manager_id = null,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set member_role = 'client',
        member_scope = 'workspace',
        membership_status = 'pending',
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    return true;
  end if;

  if normalized_intent = 'clear_manager' then
    if target_profile.role::text <> 'client' then
      raise exception 'Only client profiles can have a manager cleared.';
    end if;

    for assignment_record in
      select ca.*
      from public.client_manager_assignments ca
      where ca.workspace_id = workspace_id_value
        and ca.client_id = target_profile_id
        and ca.assignment_status in ('pending', 'active')
    loop
      update public.client_manager_assignments
      set assignment_status = 'revoked',
          revoked_by = auth.uid(),
          revoked_at = now()
      where id = assignment_record.id;

      perform public.access_log_assignment_event(
        assignment_record.id,
        workspace_id_value,
        target_profile_id,
        assignment_record.manager_id,
        'master_cleared_client_manager',
        assignment_record.assignment_status,
        'revoked',
        jsonb_build_object('phase', '11D')
      );
    end loop;

    update public.profiles
    set manager_id = null,
        account_status = case
          when account_status::text = 'disabled' then account_status
          else 'pending_manager_assignment'::public.account_status
        end,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = case
          when membership_status = 'disabled' then membership_status
          else 'pending'
        end,
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    return true;
  end if;

  if normalized_intent in ('disable', 'suspend', 'activate') then
    update public.profiles
    set account_status = case
          when normalized_intent = 'disable' then 'disabled'::public.account_status
          when normalized_intent = 'suspend' then 'suspended'::public.account_status
          else 'active'::public.account_status
        end,
        updated_at = now()
    where id = target_profile_id;

    update public.workspace_members
    set membership_status = case
          when normalized_intent = 'disable' then 'disabled'
          when normalized_intent = 'suspend' then 'suspended'
          else 'active'
        end,
        joined_at = case when normalized_intent = 'activate' then coalesce(joined_at, now()) else joined_at end,
        updated_at = now()
    where workspace_id = workspace_id_value
      and profile_id = target_profile_id;

    return true;
  end if;

  raise exception 'Unsupported master control intent.';
end;
$$;

grant execute on function public.access_workspace_master_control_v1(uuid, text) to authenticated;

notify pgrst, 'reload schema';
