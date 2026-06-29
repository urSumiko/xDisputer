-- Phase 14 — Template intelligence metadata
-- Additive only. Safe for local and production.

alter table if exists public.template_assets
  add column if not exists validation_json jsonb not null default '{}'::jsonb;

alter table if exists public.template_assets
  add column if not exists archived_at timestamptz;

alter table if exists public.template_assets
  add column if not exists content_hash text;

create index if not exists idx_template_assets_active_latest_slot
  on public.template_assets (
    owner_id,
    round_label,
    template_kind,
    letter_type,
    exhibit_kind,
    version_number desc,
    updated_at desc
  )
  where is_active = true;

create index if not exists idx_template_assets_archived_cleanup
  on public.template_assets (owner_id, archived_at, updated_at desc)
  where archived_at is not null;

create index if not exists idx_template_assets_content_hash
  on public.template_assets (owner_id, content_hash)
  where content_hash is not null;

notify pgrst, 'reload schema';
