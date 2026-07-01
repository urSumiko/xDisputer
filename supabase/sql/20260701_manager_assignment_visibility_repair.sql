-- xDisputer manager assignment visibility repair
-- Purpose:
-- 1) Keep profiles.manager_id assignments visible to the assigned Manager.
-- 2) Make Master demotion blockers match what Manager Access Control can see.
-- 3) Add a safe RPC for checking live assigned Disputer seat counts.

create index if not exists profiles_manager_assignment_status_idx
  on public.profiles (manager_id, role, account_status)
  where manager_id is not null;

create or replace function public.access_manager_live_seat_counts_v1(profile_ids uuid[])
returns table(profile_id uuid, current_clients bigint)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select unnest(coalesce(profile_ids, array[]::uuid[])) as id
  ), actor as (
    select p.id, p.role from public.profiles p where p.id = auth.uid()
  )
  select
    r.id as profile_id,
    count(c.id)::bigint as current_clients
  from requested r
  cross join actor a
  left join public.profiles c
    on c.manager_id = r.id
   and c.role = 'client'
   and coalesce(c.account_status, 'active') in ('active', 'pending_manager_approval')
  where a.role in ('master', 'manager', 'admin')
    and (a.role = 'master' or a.id = r.id)
  group by r.id;
$$;

grant execute on function public.access_manager_live_seat_counts_v1(uuid[]) to authenticated;

create or replace function public.access_manager_direct_clients_v1(
  manager_id_input uuid default null,
  view_input text default 'clients',
  search_input text default null,
  page_input integer default 1,
  page_size_input integer default 25
)
returns table(
  id uuid,
  email text,
  full_name text,
  role text,
  account_status text,
  manager_id uuid,
  manager_invite_code text,
  created_at timestamptz,
  updated_at timestamptz,
  workspace_id uuid,
  workspace_role text,
  membership_status text,
  assignment_status text,
  primary_manager_email text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  target_manager_id uuid;
  normalized_view text := coalesce(nullif(view_input, ''), 'clients');
  normalized_page integer := greatest(coalesce(page_input, 1), 1);
  normalized_page_size integer := least(greatest(coalesce(page_size_input, 25), 1), 25);
begin
  select p.role into actor_role from public.profiles p where p.id = actor_id;

  if actor_id is null or actor_role not in ('master', 'manager', 'admin') then
    raise exception 'Not authorized to read manager assignments.';
  end if;

  target_manager_id := coalesce(manager_id_input, actor_id);

  if actor_role <> 'master' and target_manager_id <> actor_id then
    raise exception 'Managers can only read their own assigned Disputers.';
  end if;

  return query
  with filtered as (
    select
      p.id,
      p.email,
      p.full_name,
      p.role,
      coalesce(p.account_status, 'active') as account_status,
      p.manager_id,
      p.manager_invite_code,
      p.created_at,
      p.updated_at,
      null::uuid as workspace_id,
      'client'::text as workspace_role,
      'direct_manager_assignment'::text as membership_status,
      'direct_manager_id'::text as assignment_status,
      m.email as primary_manager_email,
      count(*) over() as total_count
    from public.profiles p
    left join public.profiles m on m.id = p.manager_id
    where p.role = 'client'
      and p.manager_id = target_manager_id
      and (
        normalized_view in ('all', 'clients')
        or (normalized_view = 'active' and coalesce(p.account_status, 'active') = 'active')
        or (normalized_view = 'pending' and coalesce(p.account_status, 'active') in ('pending_manager_assignment', 'pending_manager_approval'))
        or (normalized_view = 'blocked' and coalesce(p.account_status, 'active') in ('disabled', 'suspended'))
      )
      and (
        search_input is null
        or search_input = ''
        or p.email ilike '%' || search_input || '%'
        or p.full_name ilike '%' || search_input || '%'
        or p.role ilike '%' || search_input || '%'
        or coalesce(p.account_status, 'active') ilike '%' || search_input || '%'
      )
    order by p.updated_at desc nulls last, p.created_at desc nulls last
  )
  select * from filtered
  limit normalized_page_size
  offset (normalized_page - 1) * normalized_page_size;
end;
$$;

grant execute on function public.access_manager_direct_clients_v1(uuid, text, text, integer, integer) to authenticated;
