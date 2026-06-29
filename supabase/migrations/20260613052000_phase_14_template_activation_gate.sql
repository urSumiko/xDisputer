-- Phase 14 — Template activation gate
-- Additive migration. Latest valid template becomes active; previous active versions are archived.

create or replace function public.app_activate_template_asset(
  asset_id_input uuid
)
returns table (
  asset_id uuid,
  archived_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_record public.template_assets%rowtype;
  archived_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select * into target_record
  from public.template_assets
  where id = asset_id_input
    and owner_id = auth.uid();

  if target_record.id is null then
    raise exception 'Template asset not found.';
  end if;

  update public.template_assets
  set
    is_active = false,
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where owner_id = target_record.owner_id
    and round_label = target_record.round_label
    and template_kind = target_record.template_kind
    and coalesce(letter_type::text, '') = coalesce(target_record.letter_type::text, '')
    and coalesce(exhibit_kind::text, '') = coalesce(target_record.exhibit_kind::text, '')
    and id <> target_record.id
    and is_active = true;

  get diagnostics archived_total = row_count;

  update public.template_assets
  set
    is_active = true,
    archived_at = null,
    updated_at = now()
  where id = target_record.id
    and owner_id = target_record.owner_id;

  return query select target_record.id, archived_total;
end;
$$;

grant execute on function public.app_activate_template_asset(uuid) to authenticated;

with ranked_active as (
  select
    id,
    row_number() over (
      partition by owner_id, round_label, template_kind, coalesce(letter_type::text, ''), coalesce(exhibit_kind::text, '')
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

create unique index if not exists idx_template_assets_one_active_per_slot
  on public.template_assets (
    owner_id,
    round_label,
    template_kind,
    coalesce(letter_type::text, ''),
    coalesce(exhibit_kind::text, '')
  )
  where is_active = true;

notify pgrst, 'reload schema';
