alter table public.notifications
  add column if not exists recipient_role text;

alter table public.notifications
  drop constraint if exists notifications_recipient_role_check;

alter table public.notifications
  add constraint notifications_recipient_role_check
  check (recipient_role is null or recipient_role in ('client', 'manager', 'master'));

alter table public.notifications
  drop constraint if exists notifications_has_audience;

alter table public.notifications
  add constraint notifications_has_audience
  check (recipient_user_id is not null or recipient_role is not null);

create index if not exists notifications_recipient_role_created_idx
  on public.notifications (recipient_role, created_at desc);

notify pgrst, 'reload schema';
