-- Realtime refresh for entitlement changes.
-- Keeps client output-limit pause screen updated without browser interval polling.

do $$
begin
  alter publication supabase_realtime add table public.client_entitlement_limits;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.generation_runs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
