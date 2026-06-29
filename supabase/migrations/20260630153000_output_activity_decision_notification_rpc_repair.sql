-- Output Activity decision notification RPC repair.
-- Fixes missing PostgREST callable overload:
-- public.sync_output_activity_decision_notification_v1(activity_id_input uuid)
-- Also preserves the real manager decision timestamp for Disputer notifications.

create or replace function public.sync_output_activity_decision_notification_v1(activity_id_input uuid)
returns table (
  activity_id uuid,
  notification_id uuid,
  sync_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_row record;
  manager_row record;
  notification_id_value uuid;
  title_value text;
  body_value text;
  href_value text;
  severity_value text;
  decision_at_value timestamptz;
begin
  if activity_id_input is null then
    return query select null::uuid, null::uuid, 'missing-activity-id'::text;
    return;
  end if;

  select *
  into activity_row
  from public.manager_disputer_output_approvals
  where id = activity_id_input;

  if activity_row.id is null then
    return query select activity_id_input, null::uuid, 'activity-not-found'::text;
    return;
  end if;

  if activity_row.manager_id is distinct from auth.uid() then
    return query select activity_row.id, null::uuid, 'not-authorized'::text;
    return;
  end if;

  if activity_row.is_per_output is not true then
    return query select activity_row.id, null::uuid, 'not-per-output'::text;
    return;
  end if;

  if activity_row.status not in ('approved', 'rejected') then
    return query select activity_row.id, null::uuid, 'not-decision-status'::text;
    return;
  end if;

  select full_name, email
  into manager_row
  from public.profiles
  where id = activity_row.manager_id;

  decision_at_value := coalesce(activity_row.approved_at, activity_row.rejected_at, activity_row.updated_at, activity_row.created_at, now());
  href_value := '/workspace?outputActivity=' || activity_row.id::text;
  title_value := case
    when activity_row.status = 'approved' then 'Per-output letter confirmed'
    else 'Per-output letter returned'
  end;
  severity_value := case
    when activity_row.status = 'approved' then 'success'
    else 'warning'
  end;
  body_value := case
    when activity_row.status = 'approved' then coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' confirmed your per-output generated letter for ' || coalesce(activity_row.client_name, 'the letter client') || '.'
    else coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' returned your per-output generated letter for ' || coalesce(activity_row.client_name, 'the letter client') || '.'
  end;

  select id
  into notification_id_value
  from public.notifications
  where recipient_user_id = activity_row.disputer_id
    and href = href_value
  order by created_at asc
  limit 1;

  if notification_id_value is null then
    begin
      insert into public.notifications(
        recipient_user_id,
        recipient_role,
        title,
        body,
        href,
        severity,
        created_by,
        created_at
      ) values (
        activity_row.disputer_id,
        null,
        title_value,
        body_value,
        href_value,
        severity_value,
        activity_row.manager_id,
        decision_at_value
      ) returning id into notification_id_value;
    exception when unique_violation then
      select id
      into notification_id_value
      from public.notifications
      where recipient_user_id = activity_row.disputer_id
        and href = href_value
      order by created_at asc
      limit 1;
    end;
  end if;

  update public.notifications
  set title = title_value,
      body = body_value,
      severity = severity_value,
      created_by = activity_row.manager_id,
      created_at = decision_at_value
  where id = notification_id_value;

  return query select activity_row.id, notification_id_value, 'synced'::text;
end;
$$;

grant execute on function public.sync_output_activity_decision_notification_v1(uuid) to authenticated;

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
  decision_at_value timestamptz;
begin
  if new.is_per_output is not true then
    return new;
  end if;

  if new.status not in ('approved', 'rejected') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status and old.updated_at is not distinct from new.updated_at then
    return new;
  end if;

  select full_name, email
  into manager_row
  from public.profiles
  where id = new.manager_id;

  decision_at_value := coalesce(new.approved_at, new.rejected_at, new.updated_at, new.created_at, now());
  href_value := '/workspace?outputActivity=' || new.id::text;
  title_value := case
    when new.status = 'approved' then 'Per-output letter confirmed'
    else 'Per-output letter returned'
  end;
  severity_value := case
    when new.status = 'approved' then 'success'
    else 'warning'
  end;
  body_value := case
    when new.status = 'approved' then coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' confirmed your per-output generated letter for ' || coalesce(new.client_name, 'the letter client') || '.'
    else coalesce(manager_row.full_name, manager_row.email, 'Your manager') || ' returned your per-output generated letter for ' || coalesce(new.client_name, 'the letter client') || '.'
  end;

  select id
  into notification_id_value
  from public.notifications
  where recipient_user_id = new.disputer_id
    and href = href_value
  order by created_at asc
  limit 1;

  if notification_id_value is null then
    begin
      insert into public.notifications(
        recipient_user_id,
        recipient_role,
        title,
        body,
        href,
        severity,
        created_by,
        created_at
      ) values (
        new.disputer_id,
        null,
        title_value,
        body_value,
        href_value,
        severity_value,
        new.manager_id,
        decision_at_value
      ) returning id into notification_id_value;
    exception when unique_violation then
      select id
      into notification_id_value
      from public.notifications
      where recipient_user_id = new.disputer_id
        and href = href_value
      order by created_at asc
      limit 1;
    end;
  end if;

  update public.notifications
  set title = title_value,
      body = body_value,
      severity = severity_value,
      created_by = new.manager_id,
      created_at = decision_at_value
  where id = notification_id_value;

  return new;
end;
$$;

drop trigger if exists manager_output_decision_notify_client on public.manager_disputer_output_approvals;
create trigger manager_output_decision_notify_client
after insert or update of status, updated_at on public.manager_disputer_output_approvals
for each row
when (new.status in ('approved', 'rejected'))
execute function public.sync_output_activity_decision_notification_v1();

-- Repair recent already-decided rows and reset their notification timestamp to the real decision time.
do $$
declare
  decision_row record;
begin
  for decision_row in
    select id
    from public.manager_disputer_output_approvals
    where is_per_output is true
      and status in ('approved', 'rejected')
      and coalesce(updated_at, created_at) >= now() - interval '60 days'
    order by coalesce(updated_at, created_at) desc
    limit 300
  loop
    perform * from public.sync_output_activity_decision_notification_v1(decision_row.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
