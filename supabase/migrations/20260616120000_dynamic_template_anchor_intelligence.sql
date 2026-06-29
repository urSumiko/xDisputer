create table if not exists public.template_anchor_rules (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  template_family_key text,
  anchor_kind text not null,
  anchor_label text not null,
  insert_mode text not null default 'insert-after-heading',
  source text not null default 'manager-rule',
  paragraph_index integer,
  paragraph_fingerprint text,
  matched_text text,
  confidence numeric not null default 1,
  rule_status text not null default 'active',
  applies_to_future_versions boolean not null default false,
  rule_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists template_anchor_rules_manager_idx
  on public.template_anchor_rules(manager_user_id);

create index if not exists template_anchor_rules_template_asset_idx
  on public.template_anchor_rules(template_asset_id);

create index if not exists template_anchor_rules_family_idx
  on public.template_anchor_rules(template_family_key);

create unique index if not exists template_anchor_rules_active_unique_idx
  on public.template_anchor_rules(template_asset_id, anchor_kind)
  where rule_status = 'active';

alter table public.template_anchor_rules enable row level security;

drop policy if exists template_anchor_rules_manager_read on public.template_anchor_rules;
create policy template_anchor_rules_manager_read
on public.template_anchor_rules
for select
to authenticated
using (manager_user_id = auth.uid());

drop policy if exists template_anchor_rules_manager_write on public.template_anchor_rules;
create policy template_anchor_rules_manager_write
on public.template_anchor_rules
for all
to authenticated
using (manager_user_id = auth.uid())
with check (manager_user_id = auth.uid());

create table if not exists public.template_validation_events (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid,
  template_family_key text,
  validation_status text not null,
  validation_source text not null default 'upload',
  anchors_json jsonb not null default '[]'::jsonb,
  diff_json jsonb not null default '{}'::jsonb,
  repair_plan_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists template_validation_events_manager_idx
  on public.template_validation_events(manager_user_id);

create index if not exists template_validation_events_template_asset_idx
  on public.template_validation_events(template_asset_id);

alter table public.template_validation_events enable row level security;

drop policy if exists template_validation_events_manager_read on public.template_validation_events;
create policy template_validation_events_manager_read
on public.template_validation_events
for select
to authenticated
using (manager_user_id = auth.uid());

drop policy if exists template_validation_events_manager_insert on public.template_validation_events;
create policy template_validation_events_manager_insert
on public.template_validation_events
for insert
to authenticated
with check (manager_user_id = auth.uid());

notify pgrst, 'reload schema';
