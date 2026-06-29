-- Manager template scope and assignment model
-- Purpose:
--   1. Clients use the active default templates uploaded by their assigned manager.
--   2. Clients cannot upload/activate/delete templates.
--   3. Managers keep one active template per manager + round + slot.
-- Safe to run more than once.

create table if not exists public.manager_client_assignments (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null references public.profiles(id) on delete cascade,
  client_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_manager_client_assignments_manager
  on public.manager_client_assignments (manager_user_id, status, updated_at desc);

create index if not exists idx_manager_client_assignments_client
  on public.manager_client_assignments (client_user_id, status, updated_at desc);

create unique index if not exists idx_manager_client_assignments_one_active_client
  on public.manager_client_assignments (client_user_id)
  where status = 'active';

insert into public.manager_client_assignments (manager_user_id, client_user_id, status, assigned_by)
select
  p.manager_id,
  p.id,
  'active',
  p.manager_id
from public.profiles p
where p.role = 'client'
  and p.manager_id is not null
on conflict do nothing;

alter table public.template_assets
  add column if not exists manager_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists uploaded_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists template_scope text not null default 'MANAGER' check (template_scope in ('MANAGER'));

update public.template_assets
set
  manager_user_id = coalesce(manager_user_id, owner_id),
  uploaded_by_user_id = coalesce(uploaded_by_user_id, owner_id),
  template_scope = 'MANAGER'
where manager_user_id is null
   or uploaded_by_user_id is null
   or template_scope is distinct from 'MANAGER';

alter table public.template_assets
  alter column manager_user_id set not null,
  alter column uploaded_by_user_id set not null;

-- Remove old owner-scoped active-slot index if it exists; manager scope is now authoritative.
drop index if exists public.idx_template_assets_one_active_per_slot;

with ranked_active as (
  select
    id,
    row_number() over (
      partition by
        manager_user_id,
        round_label,
        template_kind,
        coalesce(letter_type::text, ''),
        coalesce(exhibit_kind::text, '')
      order by version_number desc, updated_at desc, created_at desc
    ) as active_rank
  from public.template_assets
  where is_active = true
)
update public.template_assets ta
set
  is_active = false,
  archived_at = coalesce(ta.archived_at, now()),
  updated_at = now()
from ranked_active ranked
where ta.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists idx_template_assets_one_active_per_manager_slot
  on public.template_assets (
    manager_user_id,
    round_label,
    template_kind,
    coalesce(letter_type::text, ''),
    coalesce(exhibit_kind::text, '')
  )
  where is_active = true;

create index if not exists idx_template_assets_manager_active
  on public.template_assets (manager_user_id, round_label, template_kind, is_active, version_number desc, updated_at desc);

create or replace function public.app_resolve_template_manager_v1(client_user_id_input uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role text;
  direct_manager uuid;
  assignment_manager uuid;
begin
  if client_user_id_input is null then
    return null;
  end if;

  select role::text, manager_id
  into profile_role, direct_manager
  from public.profiles
  where id = client_user_id_input;

  if profile_role in ('master', 'manager', 'admin') then
    return client_user_id_input;
  end if;

  if direct_manager is not null then
    return direct_manager;
  end if;

  select manager_user_id
  into assignment_manager
  from public.manager_client_assignments
  where client_user_id = client_user_id_input
    and status = 'active'
  order by updated_at desc
  limit 1;

  return assignment_manager;
end;
$$;

grant execute on function public.app_resolve_template_manager_v1(uuid) to authenticated;

create or replace function public.app_activate_manager_template_asset_v1(asset_id_input uuid)
returns table (
  asset_id uuid,
  archived_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_manager uuid;
  target_owner uuid;
  target_round text;
  target_kind text;
  target_letter text;
  target_exhibit text;
  archived_total integer := 0;
begin
  select
    manager_user_id,
    owner_id,
    round_label::text,
    template_kind::text,
    coalesce(letter_type::text, ''),
    coalesce(exhibit_kind::text, '')
  into
    target_manager,
    target_owner,
    target_round,
    target_kind,
    target_letter,
    target_exhibit
  from public.template_assets
  where id = asset_id_input;

  if target_manager is null then
    return;
  end if;

  if target_manager <> auth.uid() and target_owner <> auth.uid() then
    return;
  end if;

  update public.template_assets
  set
    is_active = false,
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where manager_user_id = target_manager
    and round_label::text = target_round
    and template_kind::text = target_kind
    and coalesce(letter_type::text, '') = target_letter
    and coalesce(exhibit_kind::text, '') = target_exhibit
    and id <> asset_id_input
    and is_active = true;

  get diagnostics archived_total = row_count;

  update public.template_assets
  set
    is_active = true,
    archived_at = null,
    updated_at = now()
  where id = asset_id_input
    and manager_user_id = target_manager;

  return query select asset_id_input, archived_total;
end;
$$;

grant execute on function public.app_activate_manager_template_asset_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
