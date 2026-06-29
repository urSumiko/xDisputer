create type public.user_role as enum ('admin', 'client');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'client'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile name"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
  )
);

create policy "Admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
  )
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled case',
  status text not null default 'draft' check (status in ('draft', 'active', 'review', 'delivered', 'archived')),
  current_round text not null default '1st Round',
  client_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_hash text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.filings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bureau text,
  packet_type text,
  status text not null default 'pending' check (status in ('pending', 'prepared', 'sent', 'responded', 'closed')),
  due_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cases enable row level security;
alter table public.workspaces enable row level security;
alter table public.filings enable row level security;
alter table public.audit_logs enable row level security;

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at before update on public.cases for each row execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();

drop trigger if exists filings_set_updated_at on public.filings;
create trigger filings_set_updated_at before update on public.filings for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create policy "Users can manage their own cases"
on public.cases
for all
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "Users can manage their own workspaces"
on public.workspaces
for all
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "Users can manage their own filings"
on public.filings
for all
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "Users can read own audit logs and admins can read all"
on public.audit_logs
for select
to authenticated
using (actor_id = auth.uid() or public.is_admin());

create policy "Users can create own audit logs"
on public.audit_logs
for insert
to authenticated
with check (actor_id = auth.uid() or public.is_admin());

create index if not exists cases_owner_id_idx on public.cases(owner_id);
create index if not exists workspaces_case_id_idx on public.workspaces(case_id);
create index if not exists filings_case_id_idx on public.filings(case_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
