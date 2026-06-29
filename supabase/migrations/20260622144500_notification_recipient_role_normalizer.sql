-- Normalize notification recipient roles for consistent manager/client bell reads.
-- Browser/UI reads by recipient_user_id first; this trigger preserves recipient_role for legacy role-wide fallbacks and diagnostics.

create or replace function public.normalize_notification_recipient_role_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value text;
begin
  if new.recipient_role is null and new.recipient_user_id is not null then
    select case
      when p.role::text in ('admin', 'manager') then 'manager'
      when p.role::text = 'master' then 'master'
      else 'client'
    end
    into role_value
    from public.profiles p
    where p.id = new.recipient_user_id;

    new.recipient_role := role_value;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_normalize_recipient_role on public.notifications;
create trigger notifications_normalize_recipient_role
before insert or update of recipient_user_id, recipient_role on public.notifications
for each row
execute function public.normalize_notification_recipient_role_v1();

update public.notifications n
set recipient_role = case
  when p.role::text in ('admin', 'manager') then 'manager'
  when p.role::text = 'master' then 'master'
  else 'client'
end
from public.profiles p
where n.recipient_user_id = p.id
  and n.recipient_role is null;

notify pgrst, 'reload schema';
