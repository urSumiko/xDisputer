-- Account profile settings database contract.
-- This gives the authenticated app a database fallback for saving the current user's display name.

alter table if exists public.profiles
  add column if not exists full_name text;

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_current_account_profile_v1(display_name_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := auth.email();
  normalized_display_name text := nullif(left(regexp_replace(coalesce(display_name_input, ''), '\s+', ' ', 'g'), 120), '');
  profile_row public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, full_name, updated_at)
  values (current_user_id, current_email, normalized_display_name, now())
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = coalesce(public.profiles.email, excluded.email),
        updated_at = now();

  select * into profile_row from public.profiles where id = current_user_id;
  return to_jsonb(profile_row);
end;
$$;

grant execute on function public.update_current_account_profile_v1(text) to authenticated;

notify pgrst, 'reload schema';
