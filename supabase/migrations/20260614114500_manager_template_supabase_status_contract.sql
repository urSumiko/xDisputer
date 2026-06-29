-- Manager template Supabase status contract
-- Additive only. Confirms the database layer used by manager uploads/removals and client generation reads.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'template-assets',
  'template-assets',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.template_assets
  add column if not exists manager_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists uploaded_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists template_scope text not null default 'MANAGER' check (template_scope in ('MANAGER')),
  add column if not exists validation_json jsonb not null default '{}'::jsonb,
  add column if not exists rule_json jsonb not null default '{}'::jsonb,
  add column if not exists archived_at timestamptz,
  add column if not exists content_hash text;

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

create index if not exists idx_template_assets_manager_active_runtime
  on public.template_assets (manager_user_id, is_active, round_label, template_kind, version_number desc, updated_at desc);

create or replace function public.app_manager_template_slot_status_v1(round_input text default null)
returns table (
  asset_id uuid,
  manager_user_id uuid,
  round_label text,
  template_kind text,
  letter_type text,
  exhibit_kind text,
  original_filename text,
  version_number integer,
  content_hash text,
  storage_bucket text,
  storage_path text,
  updated_at timestamptz,
  used_by_client_generation boolean
)
language sql
security definer
set search_path = public
as $$
  with manager_scope as (
    select public.app_resolve_template_manager_v1(auth.uid()) as manager_id
  )
  select
    ta.id,
    ta.manager_user_id,
    ta.round_label::text,
    ta.template_kind::text,
    ta.letter_type::text,
    ta.exhibit_kind::text,
    ta.original_filename,
    ta.version_number,
    ta.content_hash,
    ta.storage_bucket,
    ta.storage_path,
    ta.updated_at,
    true as used_by_client_generation
  from public.template_assets ta
  join manager_scope scope on scope.manager_id = ta.manager_user_id
  where ta.is_active = true
    and (round_input is null or ta.round_label::text = round_input)
  order by ta.round_label::text, ta.template_kind::text, ta.version_number desc, ta.updated_at desc;
$$;

grant execute on function public.app_manager_template_slot_status_v1(text) to authenticated;

notify pgrst, 'reload schema';
