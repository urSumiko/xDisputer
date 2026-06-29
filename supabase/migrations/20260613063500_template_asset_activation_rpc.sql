-- Template asset activation RPC
-- Purpose: activate one template asset and archive other active assets in the same slot.
-- This complements the upload route and active-slot unique index.

create or replace function public.app_activate_template_asset_v1(
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
  target_owner uuid;
  target_round text;
  target_kind text;
  target_letter text;
  target_exhibit text;
  archived_total integer := 0;
begin
  select
    owner_id,
    round_label::text,
    template_kind::text,
    coalesce(letter_type::text, ''),
    coalesce(exhibit_kind::text, '')
  into
    target_owner,
    target_round,
    target_kind,
    target_letter,
    target_exhibit
  from public.template_assets
  where id = asset_id_input;

  if target_owner is null then
    return;
  end if;

  if target_owner <> auth.uid() then
    return;
  end if;

  update public.template_assets
  set
    is_active = false,
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where owner_id = target_owner
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
    and owner_id = target_owner;

  return query select asset_id_input, archived_total;
end;
$$;

grant execute on function public.app_activate_template_asset_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
