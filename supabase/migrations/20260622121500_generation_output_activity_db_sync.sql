-- Database-owned generation -> manager output activity and notification sync.
-- Permanent safety net: every generated run can create one manager activity row and one manager notification.

alter table if exists public.generation_runs
  add column if not exists per_output_pay boolean not null default false;

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
  href_value text;
  title_value text;
  body_value text;
  existing_activity_id uuid;
  inserted_notification_id uuid;
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
  href_value := case when is_per_output_value then '/admin/output-activity-v2?filter=per_output' else '/admin/output-activity-v2?filter=not_per_output' end;
  title_value := case when is_per_output_value then 'Per-output client generated a letter' else 'Fulltime Output generated' end;
  body_value := case
    when is_per_output_value then coalesce(client_row.full_name, client_row.email, 'A disputer') || ' generated ' || output_count_value::text || ' output item(s) for ' || coalesce(run_row.client_name, 'Unknown client') || '. Confirm it before it affects salary.'
    else coalesce(client_row.full_name, client_row.email, 'A disputer') || ' generated ' || output_count_value::text || ' fulltime output item(s) for ' || coalesce(run_row.client_name, 'Unknown client') || '. No confirmation is required.'
  end;

  select id into existing_activity_id
  from public.manager_disputer_output_approvals
  where generation_run_id = run_row.id
  order by created_at desc
  limit 1;

  if existing_activity_id is null then
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
    ) returning id into existing_activity_id;
  end if;

  select id into inserted_notification_id
  from public.notifications
  where recipient_user_id = manager_id_value
    and created_by = run_row.owner_id
    and href = href_value
    and title = title_value
    and created_at >= run_row.created_at - interval '2 minutes'
    and created_at <= now() + interval '2 minutes'
  order by created_at desc
  limit 1;

  if inserted_notification_id is null then
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
      href_value,
      case when is_per_output_value then 'warning' else 'info' end,
      run_row.owner_id
    ) returning id into inserted_notification_id;
  end if;

  return query select existing_activity_id, inserted_notification_id, 'synced'::text;
end;
$$;

grant execute on function public.sync_generation_output_activity_v1(uuid) to authenticated;

create or replace function public.sync_generation_output_activity_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_generation_output_activity_v1(new.id);
  return new;
end;
$$;

drop trigger if exists generation_runs_sync_output_activity on public.generation_runs;
create trigger generation_runs_sync_output_activity
after insert on public.generation_runs
for each row
when (new.output_status = 'generated')
execute function public.sync_generation_output_activity_trigger_v1();

-- Backfill recent generated runs that were missed by older app code.
do $$
declare
  run_id uuid;
begin
  for run_id in
    select gr.id
    from public.generation_runs gr
    join public.profiles p on p.id = gr.owner_id
    where gr.output_status = 'generated'
      and p.manager_id is not null
      and gr.created_at >= now() - interval '7 days'
      and not exists (
        select 1
        from public.manager_disputer_output_approvals a
        where a.generation_run_id = gr.id
      )
    order by gr.created_at desc
    limit 100
  loop
    perform public.sync_generation_output_activity_v1(run_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
