create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid null references auth.users(id) on delete cascade,
  recipient_role text null check (recipient_role in ('client', 'manager', 'master')),
  title text not null,
  body text,
  href text,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint notifications_has_audience check (recipient_user_id is not null or recipient_role is not null)
);

create index if not exists notifications_recipient_user_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_role_created_idx
  on public.notifications (recipient_role, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_direct on public.notifications;
create policy notifications_read_direct
on public.notifications
for select
using (auth.uid() = recipient_user_id);

drop policy if exists notifications_read_role on public.notifications;
create policy notifications_read_role
on public.notifications
for select
using (
  recipient_role is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = recipient_role
  )
);

drop policy if exists notifications_update_direct_read_state on public.notifications;
create policy notifications_update_direct_read_state
on public.notifications
for update
using (auth.uid() = recipient_user_id)
with check (auth.uid() = recipient_user_id);
