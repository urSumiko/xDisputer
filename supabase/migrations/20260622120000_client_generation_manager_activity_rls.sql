-- Client generation -> manager output activity + notifications RLS bridge.
-- Root cause fixed:
--   1. Client generation route runs as the client, but manager_user_settings was manager-select only.
--   2. Client generation inserted manager_disputer_output_approvals for manager_id, but insert/select RLS only allowed manager_id = auth.uid().
--   3. createNotification inserted into notifications, but notifications had select/update policies only and no insert policy.
--
-- This keeps manager ownership intact while allowing a client to create activity rows only for their own assigned manager.

-- Client can read only their own manager payroll setting so the generation route can decide
-- whether output is forced per-output or fulltime output.
drop policy if exists manager_user_settings_select_self_as_disputer on public.manager_user_settings;
create policy manager_user_settings_select_self_as_disputer
on public.manager_user_settings
for select
to authenticated
using (user_id = auth.uid());

-- Client can insert only their own generated output activity for their assigned manager.
drop policy if exists manager_output_approvals_insert_self_generation on public.manager_disputer_output_approvals;
create policy manager_output_approvals_insert_self_generation
on public.manager_disputer_output_approvals
for insert
to authenticated
with check (
  disputer_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.manager_id = manager_disputer_output_approvals.manager_id
  )
);

-- Client can read back only their own generated output activity rows after insert().select('id').
drop policy if exists manager_output_approvals_select_self_generation on public.manager_disputer_output_approvals;
create policy manager_output_approvals_select_self_generation
on public.manager_disputer_output_approvals
for select
to authenticated
using (disputer_id = auth.uid());

-- App code can create direct/role notifications as the authenticated actor.
-- Read visibility remains controlled by the existing direct/role select policies.
drop policy if exists notifications_insert_authenticated_actor on public.notifications;
create policy notifications_insert_authenticated_actor
on public.notifications
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (recipient_user_id is not null or recipient_role is not null)
);

notify pgrst, 'reload schema';
