-- Template asset active-slot guard
-- Purpose: keep one active template asset per owner + round + slot.
-- Safe to run more than once.

with ranked_active as (
  select
    id,
    row_number() over (
      partition by
        owner_id,
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

create unique index if not exists idx_template_assets_one_active_per_slot
  on public.template_assets (
    owner_id,
    round_label,
    template_kind,
    coalesce(letter_type::text, ''),
    coalesce(exhibit_kind::text, '')
  )
  where is_active = true;

create index if not exists idx_template_assets_archived_by_owner
  on public.template_assets (owner_id, archived_at desc, updated_at desc)
  where archived_at is not null;

notify pgrst, 'reload schema';
