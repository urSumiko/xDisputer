-- Phase 11 validation helpers
-- These are safe read-only checks, except the set_config calls that simulate auth.uid() in SQL Editor.
-- Use explicit uuid casts for nullable RPC arguments.

-- Check that the central context RPC exists.
select
  p.proname as function_name,
  p.oid::regprocedure::text as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'access_get_actor_context'
order by signature;

-- Simulate master context in SQL Editor.
select set_config(
  'request.jwt.claim.sub',
  (
    select id::text
    from public.profiles
    where lower(email) = lower('mycoquibuyen2002@gmail.com')
    limit 1
  ),
  false
);

select *
from public.access_get_actor_context(null::uuid);
