-- Automatic manager decision -> client notification trigger.
-- Root cause fixed: client notifications for Confirm/Return depended on the HTTP route only.
-- This makes the database canonical: any approval status update creates/updates the client bell row.

create or replace function public.sync_output_activity_decision_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_row record;
  notification_id_value uuid;
  title_value text;
  body_value text;
  href_value text;
  severity_value text;
begin
  if new.is_per_output is not true then
    return new;
  end if;

  if new.status not in ('approved', 'rejected') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select full_name, email
  into manager_row
  from public.profiles
  where id = new.manager_id;

  href_value := '/workspace?outputActivity=' || new.id::text;
  title_value := case
    when new.status = 'approved' then 'Per-output letter confirmed'
    else 'Per-output letter returned'
  end;
  severity_value := case
    when new.status = 'approved' then 'success'
    else 'error'
  end;
  body_value := case
    when new.status = 'approved' then coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' confirmed your per-output generated letter for ' || coalesce(new.client_name, 'the client') || '.'
    else coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' returned your per-output generated letter for ' || coalesce(new.client_name, 'the client') || '.'
  end;

  select id
  into notification_id_value
  from public.notifications
  where recipient_user_id = new.disputer_id
    and created_by = new.manager_id
    and href = href_value
    and title = title_value
  order by created_at asc
  limit 1;

  if notification_id_value is null then
    insert into public.notifications(
      recipient_user_id,
      recipient_role,
      title,
      body,
      href,
      severity,
      created_by
    ) values (
      new.disputer_id,
      null,
      title_value,
      body_value,
      href_value,
      severity_value,
      new.manager_id
    );
  else
    update public.notifications
    set body = body_value,
        severity = severity_value
    where id = notification_id_value;
  end if;

  return new;
end;
$$;

drop trigger if exists manager_output_decision_notify_client on public.manager_disputer_output_approvals;
create trigger manager_output_decision_notify_client
after insert or update of status on public.manager_disputer_output_approvals
for each row
when (new.status in ('approved', 'rejected'))
execute function public.sync_output_activity_decision_notification_v1();

-- Backfill any approved/rejected rows that predate this trigger.
do $$
declare
  approval_row record;
begin
  for approval_row in
    select *
    from public.manager_disputer_output_approvals
    where is_per_output is true
      and status in ('approved', 'rejected')
      and updated_at >= now() - interval '30 days'
    order by updated_at desc
    limit 200
  loop
    update public.manager_disputer_output_approvals
    set updated_at = now()
    where id = approval_row.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
