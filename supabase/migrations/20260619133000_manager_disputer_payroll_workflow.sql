-- Manager and disputer payroll workflow.
-- Supports full-time base salary plus approved per-output extra pay.

create extension if not exists pgcrypto;

create table if not exists public.manager_user_settings (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_regular boolean not null default false,
  rate numeric(12,2) not null default 0,
  salary numeric(12,2) not null default 0,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (manager_id, user_id)
);

alter table public.manager_user_settings
  add column if not exists employment_type text not null default 'output_based',
  add column if not exists base_salary numeric(12,2) not null default 0,
  add column if not exists per_output_rate numeric(12,2) not null default 0,
  add column if not exists payday_frequency text not null default 'manual';

update public.manager_user_settings
set base_salary = case when coalesce(base_salary, 0) = 0 then coalesce(salary, 0) else base_salary end,
    per_output_rate = case when coalesce(per_output_rate, 0) = 0 then coalesce(rate, 0) else per_output_rate end,
    employment_type = case when is_regular then 'full_time' else employment_type end,
    updated_at = now();

alter table public.manager_user_settings
  drop constraint if exists manager_user_settings_employment_type_check;

alter table public.manager_user_settings
  add constraint manager_user_settings_employment_type_check
  check (employment_type in ('full_time', 'output_based'));

create table if not exists public.manager_disputer_output_approvals (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  disputer_id uuid not null references public.profiles(id) on delete cascade,
  output_label text not null default 'Manual output task',
  output_count integer not null default 1 check (output_count > 0),
  rate_amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  source text not null default 'manual',
  payday_label text,
  notes text,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manager_disputer_output_approvals
  drop constraint if exists manager_disputer_output_approvals_status_check;

alter table public.manager_disputer_output_approvals
  add constraint manager_disputer_output_approvals_status_check
  check (status in ('pending', 'approved', 'rejected', 'paid'));

alter table public.manager_user_settings enable row level security;
alter table public.manager_disputer_output_approvals enable row level security;

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

drop policy if exists manager_output_approvals_select_own on public.manager_disputer_output_approvals;
create policy manager_output_approvals_select_own
  on public.manager_disputer_output_approvals
  for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists manager_output_approvals_write_own on public.manager_disputer_output_approvals;
create policy manager_output_approvals_write_own
  on public.manager_disputer_output_approvals
  for all
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

create index if not exists manager_output_approvals_manager_status_idx
  on public.manager_disputer_output_approvals(manager_id, status, created_at desc);

create index if not exists manager_output_approvals_disputer_idx
  on public.manager_disputer_output_approvals(manager_id, disputer_id, created_at desc);

notify pgrst, 'reload schema';
