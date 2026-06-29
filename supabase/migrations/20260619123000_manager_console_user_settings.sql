-- Manager console user settings.
-- Stores manager-owned operational metadata for access control and payroll.

create table if not exists public.manager_user_settings (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_regular boolean not null default true,
  rate numeric(12,2) not null default 0,
  salary numeric(12,2) not null default 0,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (manager_id, user_id)
);

alter table public.manager_user_settings enable row level security;

drop policy if exists manager_user_settings_select_own on public.manager_user_settings;
create policy manager_user_settings_select_own
  on public.manager_user_settings
  for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists manager_user_settings_write_own on public.manager_user_settings;
create policy manager_user_settings_write_own
  on public.manager_user_settings
  for all
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

notify pgrst, 'reload schema';
