begin;

create or replace function public.record_deployment_request_event_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_actor text;
  v_comment text;
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'requested';
    v_actor := new.requested_by_email;
    v_comment := null;
    v_metadata := coalesce(new.summary, '{}'::jsonb);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_event_type := case new.status
      when 'approved' then 'approved'
      when 'rejected' then 'rejected'
      when 'cancelled' then 'cancelled'
      when 'consumed' then 'consumed'
      when 'expired' then 'expired'
      else null
    end;
    v_actor := coalesce(new.reviewed_by_email, old.reviewed_by_email, new.requested_by_email);
    v_comment := new.review_comment;
    v_metadata := jsonb_build_object(
      'previous_status', old.status,
      'next_status', new.status,
      'workflow_run_id', new.workflow_run_id,
      'workflow_url', new.workflow_url
    );
  else
    return new;
  end if;

  if v_event_type is not null then
    insert into public.deployment_request_events (
      request_id,
      event_type,
      actor_email,
      comment,
      metadata
    ) values (
      new.id,
      v_event_type,
      nullif(lower(trim(coalesce(v_actor, ''))), ''),
      nullif(trim(coalesce(v_comment, '')), ''),
      coalesce(v_metadata, '{}'::jsonb)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists deployment_requests_record_event on public.deployment_requests;
create trigger deployment_requests_record_event
after insert or update of status on public.deployment_requests
for each row
execute function public.record_deployment_request_event_trigger();

notify pgrst, 'reload schema';

commit;
