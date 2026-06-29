create table if not exists public.template_static_block_rules (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  template_family_key text,
  block_key text not null,
  block_kind text not null,
  paragraph_start integer,
  paragraph_end integer,
  manager_intent text not null default 'PRESERVE',
  preserve_when_empty boolean not null default true,
  applies_to_future_versions boolean not null default false,
  block_fingerprint text,
  sample_text text,
  rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists template_static_block_rules_asset_idx
  on public.template_static_block_rules(template_asset_id);

create index if not exists template_static_block_rules_manager_idx
  on public.template_static_block_rules(manager_user_id);

alter table public.template_static_block_rules enable row level security;

drop policy if exists template_static_block_rules_manager_rw on public.template_static_block_rules;
create policy template_static_block_rules_manager_rw
on public.template_static_block_rules
for all
to authenticated
using (manager_user_id = auth.uid())
with check (manager_user_id = auth.uid());

create table if not exists public.template_field_bindings (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  template_domain text not null,
  field_key text not null,
  source_path text not null,
  placeholder_text text,
  paragraph_index integer,
  run_index integer,
  required boolean not null default false,
  binding_status text not null default 'mapped',
  confidence numeric not null default 1,
  binding_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists template_field_bindings_unique_idx
  on public.template_field_bindings(template_asset_id, field_key);

create index if not exists template_field_bindings_manager_idx
  on public.template_field_bindings(manager_user_id);

alter table public.template_field_bindings enable row level security;

drop policy if exists template_field_bindings_manager_rw on public.template_field_bindings;
create policy template_field_bindings_manager_rw
on public.template_field_bindings
for all
to authenticated
using (manager_user_id = auth.uid())
with check (manager_user_id = auth.uid());

create table if not exists public.template_entity_block_rules (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  entity_key text not null,
  start_paragraph_index integer,
  end_paragraph_index integer,
  repeat_mode text not null default 'clone-paragraphs',
  preserve_style boolean not null default true,
  empty_behavior text not null default 'remove-section',
  required_fields text[] not null default '{}',
  prototype_text text,
  prototype_xml text,
  rule_status text not null default 'active',
  rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists template_entity_block_rules_unique_idx
  on public.template_entity_block_rules(template_asset_id, entity_key)
  where rule_status = 'active';

create index if not exists template_entity_block_rules_manager_idx
  on public.template_entity_block_rules(manager_user_id);

alter table public.template_entity_block_rules enable row level security;

drop policy if exists template_entity_block_rules_manager_rw on public.template_entity_block_rules;
create policy template_entity_block_rules_manager_rw
on public.template_entity_block_rules
for all
to authenticated
using (manager_user_id = auth.uid())
with check (manager_user_id = auth.uid());

create table if not exists public.template_domain_contracts (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  template_domain text not null,
  contract_status text not null default 'draft',
  required_fields text[] not null default '{}',
  optional_fields text[] not null default '{}',
  required_entities text[] not null default '{}',
  optional_entities text[] not null default '{}',
  validation_json jsonb not null default '{}'::jsonb,
  contract_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists template_domain_contracts_unique_idx
  on public.template_domain_contracts(template_asset_id, template_domain);

create index if not exists template_domain_contracts_manager_idx
  on public.template_domain_contracts(manager_user_id);

alter table public.template_domain_contracts enable row level security;

drop policy if exists template_domain_contracts_manager_rw on public.template_domain_contracts;
create policy template_domain_contracts_manager_rw
on public.template_domain_contracts
for all
to authenticated
using (manager_user_id = auth.uid())
with check (manager_user_id = auth.uid());

notify pgrst, 'reload schema';
