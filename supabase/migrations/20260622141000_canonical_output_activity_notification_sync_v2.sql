-- Canonical output activity + notification sync v2.
-- Root cause fixed: older partial sync functions created duplicate activity rows for one generation_run_id
-- and reused broad filter notifications across many activities. This makes sync idempotent:
-- one generated run -> one activity row -> one exact manager notification.
-- one manager decision -> one exact client notification.

alter table if exists public.generation_runs
  add column if not exists per_output_pay boolean not null default false;

-- 1) Remove duplicate activity rows before enforcing uniqueness.
with ranked_activities as (
  select
    id,
    row_number() over (
      partition by generation_run_id
      order by
        case status
          when 'approved' then 1
          when 'paid' then 2
          when 'rejected' then 3
          when 'pending' then 4
          when 'recorded' then 5
          else 9
        end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.manager_disputer_output_approvals
  where generation_run_id is not null
), duplicate_activities as (
  select id from ranked_activities where keep_rank > 1
), deleted_duplicate_notifications as (
  delete from public.notifications n
  using duplicate_activities d
  where n.href like '%' || d.id::text || '%'
  returning n.id
)
delete from public.manager_disputer_output_approvals a
using duplicate_activities d
where a.id = d.id;

-- 2) Remove duplicate exact activity notifications before enforcing uniqueness.
with ranked_notifications as (
  select
    id,
    row_number() over (
      partition by recipient_user_id, href
      order by
        case when read_at is null then 0 else 1 end,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.notifications
  where href is not null
    and (
      href like '/admin/output-activity-v2%'
      or href like '/workspace?outputActivity=%'
    )
)
delete from public.notifications n
using ranked_notifications r
where n.id = r.id
  and r.keep_rank > 1;

create unique index if not exists manager_output_approvals_generation_run_id_unique
  on public.manager_disputer_output_approvals(generation_run_id)
  where generation_run_id is not null;

create unique index if not exists notifications_output_activity_href_unique
  on public.notifications(recipient_user_id, href)
  where href is not null
    and (
      href like '/admin/output-activity-v2%'
      or href like '/workspace?outputActivity=%'
    );

create or replace function public.sync_generation_output_activity_v1(generation_run_id_input uuid)
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
  run_row record;
  client_row record;
  setting_row record;
  manager_id_value uuid;
  is_per_output_value boolean;
  output_count_value integer;
  rate_amount_value numeric;
  note_value text;
  filter_href text;
  exact_href text;
  title_value text;
  body_value text;
  activity_id_value uuid;
  notification_id_value uuid;
begin
  select * into run_row
  from public.generation_runs
  where id = generation_run_id_input;

  if run_row.id is null then
    return query select null::uuid, null::uuid, 'generation-run-not-found'::text;
    return;
  end if;

  if coalesce(run_row.output_status::text, '') <> 'generated' then
    return query select null::uuid, null::uuid, 'not-generated-status'::text;
    return;
  end if;

  select id, manager_id, full_name, email
  into client_row
  from public.profiles
  where id = run_row.owner_id;

  manager_id_value := client_row.manager_id;
  if manager_id_value is null then
    return query select null::uuid, null::uuid, 'no-manager'::text;
    return;
  end if;

  select employment_type, is_regular, per_output_rate, rate, notes
  into setting_row
  from public.manager_user_settings
  where manager_id = manager_id_value
    and user_id = run_row.owner_id;

  is_per_output_value :=
    coalesce(setting_row.employment_type::text = 'output_based', false)
    or coalesce(setting_row.is_regular = false, false)
    or coalesce(run_row.per_output_pay, false);

  output_count_value := greatest(
    1,
    coalesce(jsonb_array_length(coalesce(run_row.manifest_json::jsonb -> 'outputs', '[]'::jsonb)), 0)
  );

  rate_amount_value := case
    when is_per_output_value then greatest(coalesce(setting_row.per_output_rate, setting_row.rate, 0), 0)
    else 0
  end;

  note_value := nullif(left(regexp_replace(coalesce(setting_row.notes, ''), '\s+', ' ', 'g'), 300), '');
  filter_href := case
    when is_per_output_value then '/admin/output-activity-v2?filter=per_output'
    else '/admin/output-activity-v2?filter=not_per_output'
  end;
  title_value := case
    when is_per_output_value then 'Per-output client generated a letter'
    else 'Fulltime Output generated'
  end;
  body_value := case
    when is_per_output_value then coalesce(client_row.full_name, client_row.email, 'A disputer') || ' generated ' || output_count_value::text || ' output item(s) for ' || coalesce(run_row.client_name, 'Unknown client') || '. Confirm it before it affects salary.'
    else coalesce(client_row.full_name, client_row.email, 'A disputer') || ' generated ' || output_count_value::text || ' fulltime output item(s) for ' || coalesce(run_row.client_name, 'Unknown client') || '. No confirmation is required.'
  end;

  select id into activity_id_value
  from public.manager_disputer_output_approvals
  where generation_run_id = run_row.id
  order by created_at asc
  limit 1;

  if activity_id_value is null then
    insert into public.manager_disputer_output_approvals(
      manager_id,
      disputer_id,
      generation_run_id,
      output_label,
      output_count,
      rate_amount,
      status,
      source,
      payday_label,
      notes,
      round_label,
      letter_route,
      client_name,
      is_per_output,
      updated_at
    ) values (
      manager_id_value,
      run_row.owner_id,
      run_row.id,
      coalesce(run_row.client_name, 'Unknown client') || ' · ' || coalesce(run_row.round_label, 'Round not set') || ' generated output',
      output_count_value,
      rate_amount_value,
      case when is_per_output_value then 'pending' else 'recorded' end,
      case when is_per_output_value then 'generation_success_per_output' else 'generation_success_recorded' end,
      null,
      coalesce(note_value, 'No manager note set'),
      run_row.round_label,
      null,
      run_row.client_name,
      is_per_output_value,
      now()
    ) returning id into activity_id_value;
  else
    update public.manager_disputer_output_approvals
    set
      manager_id = manager_id_value,
      disputer_id = run_row.owner_id,
      output_count = output_count_value,
      rate_amount = rate_amount_value,
      notes = coalesce(note_value, 'No manager note set'),
      round_label = run_row.round_label,
      client_name = run_row.client_name,
      is_per_output = is_per_output_value,
      updated_at = now()
    where id = activity_id_value;
  end if;

  exact_href := filter_href || '&activity=' || activity_id_value::text;

  select id into notification_id_value
  from public.notifications
  where recipient_user_id = manager_id_value
    and href = exact_href
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
        created_by
      ) values (
        manager_id_value,
        null,
        title_value,
        body_value,
        exact_href,
        case when is_per_output_value then 'warning' else 'info' end,
        run_row.owner_id
      ) returning id into notification_id_value;
    exception when unique_violation then
      select id into notification_id_value
      from public.notifications
      where recipient_user_id = manager_id_value
        and href = exact_href
      order by created_at asc
      limit 1;
    end;
  end if;

  update public.notifications
  set
    title = title_value,
    body = body_value,
    severity = case when is_per_output_value then 'warning' else 'info' end,
    created_by = run_row.owner_id
  where id = notification_id_value;

  return query select activity_id_value, notification_id_value, 'synced'::text;
end;
$$;

grant execute on function public.sync_generation_output_activity_v1(uuid) to authenticated;

create or replace function public.sync_manager_output_activity_notifications_v1(
  manager_id_input uuid default auth.uid(),
  max_rows integer default 50
)
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
  safe_limit integer := least(greatest(coalesce(max_rows, 50), 1), 100);
  notification_id_value uuid;
  filter_href text;
  exact_href text;
  notification_title text;
  notification_body text;
begin
  if manager_id_input is null then
    return;
  end if;

  for activity_row in
    select
      a.id,
      a.manager_id,
      a.disputer_id,
      a.client_name,
      a.round_label,
      a.output_count,
      a.is_per_output,
      a.status,
      a.created_at,
      p.full_name as disputer_name,
      p.email as disputer_email
    from public.manager_disputer_output_approvals a
    left join public.profiles p on p.id = a.disputer_id
    where a.manager_id = manager_id_input
      and a.created_at >= now() - interval '30 days'
    order by a.created_at desc
    limit safe_limit
  loop
    filter_href := case
      when activity_row.is_per_output then '/admin/output-activity-v2?filter=per_output'
      else '/admin/output-activity-v2?filter=not_per_output'
    end;
    exact_href := filter_href || '&activity=' || activity_row.id::text;
    notification_title := case
      when activity_row.is_per_output then 'Per-output client generated a letter'
      else 'Fulltime Output generated'
    end;
    notification_body := case
      when activity_row.is_per_output then coalesce(activity_row.disputer_name, activity_row.disputer_email, 'A disputer') || ' generated ' || greatest(coalesce(activity_row.output_count, 1), 1)::text || ' output item(s) for ' || coalesce(activity_row.client_name, 'Unknown client') || '. Confirm it before it affects salary.'
      else coalesce(activity_row.disputer_name, activity_row.disputer_email, 'A disputer') || ' generated ' || greatest(coalesce(activity_row.output_count, 1), 1)::text || ' fulltime output item(s) for ' || coalesce(activity_row.client_name, 'Unknown client') || '. No confirmation is required.'
    end;

    select id into notification_id_value
    from public.notifications
    where recipient_user_id = manager_id_input
      and href = exact_href
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
          created_by
        ) values (
          manager_id_input,
          null,
          notification_title,
          notification_body,
          exact_href,
          case when activity_row.is_per_output then 'warning' else 'info' end,
          activity_row.disputer_id
        ) returning id into notification_id_value;
      exception when unique_violation then
        select id into notification_id_value
        from public.notifications
        where recipient_user_id = manager_id_input
          and href = exact_href
        order by created_at asc
        limit 1;
      end;
    end if;

    update public.notifications
    set
      title = notification_title,
      body = notification_body,
      href = exact_href,
      severity = case when activity_row.is_per_output then 'warning' else 'info' end,
      created_by = activity_row.disputer_id
    where id = notification_id_value;

    activity_id := activity_row.id;
    notification_id := notification_id_value;
    sync_status := 'synced';
    return next;
  end loop;
end;
$$;

grant execute on function public.sync_manager_output_activity_notifications_v1(uuid, integer) to authenticated;

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

  select id into notification_id_value
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
        created_by
      ) values (
        new.disputer_id,
        null,
        title_value,
        body_value,
        href_value,
        severity_value,
        new.manager_id
      ) returning id into notification_id_value;
    exception when unique_violation then
      select id into notification_id_value
      from public.notifications
      where recipient_user_id = new.disputer_id
        and href = href_value
      order by created_at asc
      limit 1;
    end;
  end if;

  update public.notifications
  set
    title = title_value,
    body = body_value,
    severity = severity_value,
    created_by = new.manager_id
  where id = notification_id_value;

  return new;
end;
$$;

drop trigger if exists generation_runs_sync_output_activity on public.generation_runs;
create trigger generation_runs_sync_output_activity
after insert or update of output_status, per_output_pay on public.generation_runs
for each row
when (new.output_status = 'generated')
execute function public.sync_generation_output_activity_trigger_v1();

drop trigger if exists manager_output_decision_notify_client on public.manager_disputer_output_approvals;
create trigger manager_output_decision_notify_client
after insert or update of status on public.manager_disputer_output_approvals
for each row
when (new.status in ('approved', 'rejected'))
execute function public.sync_output_activity_decision_notification_v1();

-- Repair recent generated runs and notifications after changing uniqueness rules.
do $$
declare
  run_id uuid;
  manager_id_value uuid;
begin
  for run_id in
    select gr.id
    from public.generation_runs gr
    join public.profiles p on p.id = gr.owner_id
    where gr.output_status = 'generated'
      and p.manager_id is not null
      and gr.created_at >= now() - interval '30 days'
    order by gr.created_at desc
    limit 300
  loop
    perform public.sync_generation_output_activity_v1(run_id);
  end loop;

  for manager_id_value in
    select distinct p.manager_id
    from public.profiles p
    where p.manager_id is not null
  loop
    perform public.sync_manager_output_activity_notifications_v1(manager_id_value, 100);
  end loop;
end $$;

notify pgrst, 'reload schema';
