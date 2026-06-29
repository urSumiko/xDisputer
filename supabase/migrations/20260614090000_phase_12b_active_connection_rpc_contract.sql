-- Phase 12B — Active connection RPC contract validation
-- Purpose:
--   - Re-assert that the active Vercel/Supabase runtime RPC contracts are installed.
--   - Keep performance indexes present for account directory and dashboard reload paths.
--   - Reload PostgREST schema cache after validation.
-- Safety:
--   - Additive only.
--   - No table drops.
--   - No output generation changes.
--   - No quota/client/manager usage-cap enforcement.

create extension if not exists pgcrypto;

create index if not exists idx_workspace_members_workspace_role_status_profile
  on public.workspace_members (workspace_id, member_role, membership_status, profile_id);

create index if not exists idx_workspace_members_profile_workspace
  on public.workspace_members (profile_id, workspace_id);

create index if not exists idx_client_manager_assignments_primary_client_active
  on public.client_manager_assignments (workspace_id, client_id, manager_id, assignment_status, created_at desc)
  where assignment_role = 'primary'
    and assignment_status in ('pending', 'active');

create index if not exists idx_client_manager_assignments_primary_manager_active
  on public.client_manager_assignments (workspace_id, manager_id, assignment_status, client_id, created_at desc)
  where assignment_role = 'primary'
    and assignment_status in ('pending', 'active');

create index if not exists idx_profiles_role_status_updated
  on public.profiles (role, account_status, updated_at desc);

create index if not exists idx_profiles_manager_status_updated
  on public.profiles (manager_id, account_status, updated_at desc)
  where manager_id is not null;

create index if not exists idx_template_assets_owner_round_active_slot
  on public.template_assets (
    owner_id,
    round_label,
    is_active,
    template_kind,
    letter_type,
    exhibit_kind,
    version_number desc,
    updated_at desc
  );

create index if not exists idx_generation_runs_owner_created
  on public.generation_runs (owner_id, created_at desc);

do $$
begin
  if to_regprocedure('public.access_workspace_account_summary_v1(uuid)') is null then
    raise exception 'Missing required RPC: public.access_workspace_account_summary_v1(uuid). Apply Phase 11E/12 migrations before deploying.';
  end if;

  if to_regprocedure('public.access_workspace_account_directory_v1(uuid,text,text,integer,integer)') is null then
    raise exception 'Missing required RPC: public.access_workspace_account_directory_v1(uuid,text,text,integer,integer). Apply Phase 11E/12 migrations before deploying.';
  end if;

  if to_regprocedure('public.access_workspace_attention_queue_v1(uuid,integer)') is null then
    raise exception 'Missing required RPC: public.access_workspace_attention_queue_v1(uuid,integer). Apply Phase 12 migrations before deploying.';
  end if;
end $$;

analyze public.workspace_members;
analyze public.client_manager_assignments;
analyze public.profiles;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.access_workspace_account_summary_v1(uuid)') as account_summary_rpc,
  to_regprocedure('public.access_workspace_account_directory_v1(uuid,text,text,integer,integer)') as account_directory_rpc,
  to_regprocedure('public.access_workspace_attention_queue_v1(uuid,integer)') as attention_queue_rpc;
