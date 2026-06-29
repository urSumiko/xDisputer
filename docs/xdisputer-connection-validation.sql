-- xDisputer connection validation SQL
-- Run in Supabase SQL Editor after pulling latest repo and applying pending migrations.
-- Safe: read-only checks plus PostgREST schema reload notification.

-- 1) Reload PostgREST schema cache so newly-created/replaced RPCs are visible to the API.
notify pgrst, 'reload schema';

-- 2) Validate required RPC signatures used by the active account directory and master/manager consoles.
select
  to_regprocedure('public.access_workspace_account_summary_v1(uuid)') as account_summary_rpc,
  to_regprocedure('public.access_workspace_account_directory_v1(uuid,text,text,integer,integer)') as account_directory_rpc,
  to_regprocedure('public.access_workspace_attention_queue_v1(uuid,integer)') as attention_queue_rpc,
  to_regprocedure('public.access_workspace_manager_control_v1(uuid,text)') as manager_control_rpc,
  to_regprocedure('public.access_workspace_master_control_v1(uuid,text)') as master_control_rpc;

-- Expected: all five columns must return function signatures, not null.

-- 3) Validate core multi-tenant tables expected by the active Supabase access layer.
select
  to_regclass('public.profiles') as profiles_table,
  to_regclass('public.workspaces') as workspaces_table,
  to_regclass('public.workspace_members') as workspace_members_table,
  to_regclass('public.client_manager_assignments') as client_manager_assignments_table,
  to_regclass('public.client_assignment_events') as client_assignment_events_table,
  to_regclass('public.template_assets') as template_assets_table,
  to_regclass('public.generation_runs') as generation_runs_table;

-- Expected: all table columns must return public.<table_name>, not null.

-- 4) Validate Phase 12/12B performance indexes exist where the active code expects fast reloads.
select
  indexname,
  tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_workspace_members_workspace_role_status_profile',
    'idx_workspace_members_profile_workspace',
    'idx_client_manager_assignments_primary_client_active',
    'idx_client_manager_assignments_primary_manager_active',
    'idx_profiles_role_status_updated',
    'idx_profiles_manager_status_updated',
    'idx_template_assets_owner_round_active_slot',
    'idx_generation_runs_owner_created'
  )
order by indexname;

-- Expected: eight rows.

-- 5) Validate old non-v1 workspace read wrappers are gone.
select
  to_regprocedure('public.access_workspace_account_summary(uuid)') as old_account_summary_wrapper,
  to_regprocedure('public.access_workspace_account_directory(uuid,text,text,integer,integer)') as old_account_directory_wrapper,
  to_regprocedure('public.access_workspace_attention_queue(uuid,integer)') as old_attention_queue_wrapper;

-- Expected: all three old wrapper columns are null.

-- 6) Validate current authenticated access behavior manually from the app UI after this SQL passes.
-- The SQL editor usually runs as an elevated database role, so it validates schema presence, not user-session policy behavior.
