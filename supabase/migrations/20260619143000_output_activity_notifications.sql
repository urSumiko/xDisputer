-- Output activity notification policies and schema refresh.
-- Run this after manager_disputer_payroll_workflow if notification inserts fail.

alter table if exists public.notifications enable row level security;

drop policy if exists notifications_insert_authenticated_created_by on public.notifications;
create policy notifications_insert_authenticated_created_by
on public.notifications
for insert
to authenticated
with check (created_by = auth.uid());

create index if not exists notifications_unread_direct_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);

notify pgrst, 'reload schema';
