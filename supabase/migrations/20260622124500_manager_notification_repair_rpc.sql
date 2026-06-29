-- Manager notification repair/sync RPC.
-- Root cause fixed: Output Activity could be synced while the manager bell stayed empty
-- because the notification row was missing, realtime was not enabled, or the notification
-- loader swallowed RPC result errors. This RPC derives manager bell rows from canonical
-- manager_disputer_output_approvals records and keeps the bell in sync automatically.

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
  filter_href text;
  exact_href text;
  notification_title text;
  notification_body text;
  existing_notification_id uuid;
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

    select n.id
    into existing_notification_id
    from public.notifications n
    where n.recipient_user_id = manager_id_input
      and n.created_by = activity_row.disputer_id
      and (
        n.href = exact_href
        or (
          n.href = filter_href
          and n.title = notification_title
          and n.created_at >= activity_row.created_at - interval '10 minutes'
        )
      )
    order by n.created_at desc
    limit 1;

    if existing_notification_id is null then
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
      )
      returning id into existing_notification_id;
    end if;

    activity_id := activity_row.id;
    notification_id := existing_notification_id;
    sync_status := 'synced';
    return next;
  end loop;
end;
$$;

grant execute on function public.sync_manager_output_activity_notifications_v1(uuid, integer) to authenticated;

-- Enable postgres_changes delivery for the browser bell when the project has realtime publication.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
