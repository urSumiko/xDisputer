create table if not exists public.dynamic_template_inspections (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  round_label text not null,
  inspection_status text not null default 'pending',
  detected_summary jsonb not null default '{}'::jsonb,
  static_text_blocks jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  mapped_fields jsonb not null default '[]'::jsonb,
  table_layouts jsonb not null default '[]'::jsonb,
  parser_findings jsonb not null default '[]'::jsonb,
  renderer_findings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_asset_id)
);

create table if not exists public.dynamic_template_rules (
  id uuid primary key default gen_random_uuid(),
  manager_user_id uuid not null,
  template_asset_id uuid not null,
  inspection_id uuid references public.dynamic_template_inspections(id) on delete cascade,
  rule_key text not null,
  rule_type text not null,
  rule_scope text not null,
  source_path text,
  source_text text,
  canonical_field text,
  output_token text,
  preserve boolean not null default false,
  required boolean not null default false,
  enabled boolean not null default true,
  priority integer not null default 100,
  rule_config jsonb not null default '{}'::jsonb,
  validation_state text not null default 'draft',
  validation_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_asset_id, rule_key)
);

create index if not exists dynamic_template_inspections_manager_idx on public.dynamic_template_inspections(manager_user_id);
create index if not exists dynamic_template_inspections_asset_idx on public.dynamic_template_inspections(template_asset_id);
create index if not exists dynamic_template_rules_manager_idx on public.dynamic_template_rules(manager_user_id);
create index if not exists dynamic_template_rules_asset_idx on public.dynamic_template_rules(template_asset_id);
create index if not exists dynamic_template_rules_config_gin on public.dynamic_template_rules using gin(rule_config);

alter table public.dynamic_template_inspections enable row level security;
alter table public.dynamic_template_rules enable row level security;

notify pgrst, 'reload schema';
