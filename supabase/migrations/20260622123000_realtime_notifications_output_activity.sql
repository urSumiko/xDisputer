-- Enable near-real-time notification and output-activity refreshes.
-- Client code also keeps a short polling fallback, so the UI remains fresh even if Realtime is disabled on a branch.

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then
    create publication supabase_realtime;
    alter publication supabase_realtime add table public.notifications;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.manager_disputer_output_approvals;
exception
  when duplicate_object then null;
  when undefined_object then
    create publication supabase_realtime;
    alter publication supabase_realtime add table public.manager_disputer_output_approvals;
end $$;

notify pgrst, 'reload schema';
