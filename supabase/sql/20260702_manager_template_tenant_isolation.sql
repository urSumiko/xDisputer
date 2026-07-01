-- xDisputer manager template tenant isolation repair
-- Purpose:
-- 1) Backfill owner_id for manager template assets so ownership can be checked consistently.
-- 2) Index active template lookups by manager, round, and slot.
-- 3) Provide an audit function for cross-manager template asset contradictions.

alter table if exists public.template_assets
  add column if not exists owner_id uuid;

update public.template_assets
set owner_id = manager_user_id,
    updated_at = coalesce(updated_at, now())
where owner_id is null
  and manager_user_id is not null;

update public.template_assets
set is_active = false,
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
where template_scope = 'MANAGER'
  and is_active = true
  and manager_user_id is null;

create index if not exists template_assets_manager_active_slot_idx
  on public.template_assets (manager_user_id, is_active, round_label, template_kind, letter_type, exhibit_kind, created_at desc);

create index if not exists template_assets_owner_active_idx
  on public.template_assets (owner_id, is_active, created_at desc)
  where owner_id is not null;

create or replace function public.template_assets_cross_manager_audit_v1()
returns table(
  id uuid,
  manager_user_id uuid,
  owner_id uuid,
  uploaded_by_user_id uuid,
  round_label text,
  template_kind text,
  letter_type text,
  exhibit_kind text,
  is_active boolean,
  issue text
)
language sql
security definer
set search_path = public
as $$
  select
    ta.id,
    ta.manager_user_id,
    ta.owner_id,
    ta.uploaded_by_user_id,
    ta.round_label,
    ta.template_kind,
    ta.letter_type,
    ta.exhibit_kind,
    ta.is_active,
    case
      when ta.manager_user_id is null then 'missing manager_user_id'
      when ta.owner_id is not null and ta.owner_id <> ta.manager_user_id then 'owner_id does not match manager_user_id'
      when ta.validation_json ? 'managerUserId' and ta.validation_json->>'managerUserId' <> ta.manager_user_id::text then 'validation_json managerUserId mismatch'
      when ta.rule_json ? 'managerUserId' and ta.rule_json->>'managerUserId' <> ta.manager_user_id::text then 'rule_json managerUserId mismatch'
      else 'ok'
    end as issue
  from public.template_assets ta
  where ta.template_scope = 'MANAGER'
    and (
      ta.manager_user_id is null
      or (ta.owner_id is not null and ta.owner_id <> ta.manager_user_id)
      or (ta.validation_json ? 'managerUserId' and ta.validation_json->>'managerUserId' <> ta.manager_user_id::text)
      or (ta.rule_json ? 'managerUserId' and ta.rule_json->>'managerUserId' <> ta.manager_user_id::text)
    );
$$;

grant execute on function public.template_assets_cross_manager_audit_v1() to authenticated;
