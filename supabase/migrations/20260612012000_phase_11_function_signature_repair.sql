-- Phase 11 function signature repair
-- Use this when Supabase reports: cannot change return type of existing function.
-- It drops only Phase 11 RPC/function wrappers, then the full Phase 11 SQL can recreate them.
-- This does not delete workspace, membership, assignment, profile, or generation data.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'access_get_actor_context',
        'access_can_manage_account',
        'access_workspace_account_directory',
        'access_workspace_assign_client',
        'access_workspace_approve_client',
        'access_workspace_transfer_client',
        'access_workspace_revoke_client_assignment',
        'access_log_assignment_event',
        'access_actor_workspace_role',
        'access_ensure_default_workspace_membership',
        'access_default_workspace_id',
        'access_normalized_member_status'
      ])
  LOOP
    EXECUTE format('drop function if exists %s cascade', fn.signature);
  END LOOP;
END $$;

notify pgrst, 'reload schema';
