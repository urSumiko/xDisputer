-- Template asset retention visibility
-- Purpose: identify archived template assets that are safe candidates for manual storage cleanup.
-- This does not delete files or rows.

create or replace view public.template_asset_retention_candidates_v1 as
with ranked_archived as (
  select
    id,
    owner_id,
    round_label,
    template_kind,
    letter_type,
    exhibit_kind,
    storage_bucket,
    storage_path,
    original_filename,
    content_hash,
    version_number,
    archived_at,
    updated_at,
    row_number() over (
      partition by
        owner_id,
        round_label,
        template_kind,
        coalesce(letter_type::text, ''),
        coalesce(exhibit_kind::text, '')
      order by version_number desc, updated_at desc, archived_at desc
    ) as archived_rank
  from public.template_assets
  where is_active = false
    and archived_at is not null
)
select
  id,
  owner_id,
  round_label,
  template_kind,
  letter_type,
  exhibit_kind,
  storage_bucket,
  storage_path,
  original_filename,
  content_hash,
  version_number,
  archived_at,
  updated_at,
  archived_rank,
  archived_rank > 2 as cleanup_candidate
from ranked_archived;

grant select on public.template_asset_retention_candidates_v1 to authenticated;

notify pgrst, 'reload schema';
