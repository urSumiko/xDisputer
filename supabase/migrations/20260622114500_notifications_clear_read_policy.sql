-- Allow users to clear only their own already-read direct notifications.
-- Unread notifications stay protected because read_at must already be set.

drop policy if exists notifications_delete_direct_read_state on public.notifications;
create policy notifications_delete_direct_read_state
on public.notifications
for delete
to authenticated
using (
  auth.uid() = recipient_user_id
  and read_at is not null
);

notify pgrst, 'reload schema';
