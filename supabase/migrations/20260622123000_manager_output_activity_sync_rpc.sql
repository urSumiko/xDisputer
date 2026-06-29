-- Manager-side self-healing sync for generated output activity and notifications.
-- Root cause fixed: manager UI and notification dock should not depend on direct manager
-- RLS access to public.generation_runs just to find client generated runs.

create or replace function public.sync_manager_recent_generation_output_activity_v1(
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
  run_id uuid;
  synced_row record;
  safe_limit integer := least(greatest(coalesce(max_rows, 50), 1), 100);
begin
  if manager_id_input is null then
    return;
  end if;

  for run_id in
    select gr.id
    from public.generation_runs gr
    join public.profiles p on p.id = gr.owner_id
    where p.manager_id = manager_id_input
      and gr.output_status = 'generated'
      and gr.created_at >= now() - interval '30 days'
    order by gr.created_at desc
    limit safe_limit
  loop
    select *
    into synced_row
    from public.sync_generation_output_activity_v1(run_id)
    limit 1;

    activity_id := synced_row.activity_id;
    notification_id := synced_row.notification_id;
    sync_status := synced_row.sync_status;
    return next;
  end loop;
end;
$$;

grant execute on function public.sync_manager_recent_generation_output_activity_v1(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
