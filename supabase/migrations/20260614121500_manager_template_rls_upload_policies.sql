-- Manager template RLS upload policies
-- Additive/manual-safe. Fixes "new row violates row-level security policy" for manager template upload/remove when the API uses session RLS fallback.

create extension if not exists pgcrypto;

alter table public.template_assets enable row level security;

-- Drop/recreate only the app-owned manager-template policies so this file stays idempotent.
drop policy if exists "xdisputer manager template select" on public.template_assets;
drop policy if exists "xdisputer manager template insert" on public.template_assets;
drop policy if exists "xdisputer manager template update" on public.template_assets;
drop policy if exists "xdisputer manager template delete" on public.template_assets;

create policy "xdisputer manager template select"
on public.template_assets
for select
to authenticated
using (
  manager_user_id = auth.uid()
  or uploaded_by_user_id = auth.uid()
  or exists (
    select 1
    from public.manager_client_assignments mca
    where mca.client_user_id = auth.uid()
      and mca.manager_user_id = template_assets.manager_user_id
      and mca.status = 'active'
  )
);

create policy "xdisputer manager template insert"
on public.template_assets
for insert
to authenticated
with check (
  manager_user_id = auth.uid()
  and owner_id = auth.uid()
  and uploaded_by_user_id = auth.uid()
  and template_scope = 'MANAGER'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('master', 'manager', 'admin')
      and coalesce(p.account_status, 'active') not in ('disabled', 'suspended')
  )
);

create policy "xdisputer manager template update"
on public.template_assets
for update
to authenticated
using (
  manager_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('master', 'manager', 'admin')
      and coalesce(p.account_status, 'active') not in ('disabled', 'suspended')
  )
)
with check (
  manager_user_id = auth.uid()
  and template_scope = 'MANAGER'
);

create policy "xdisputer manager template delete"
on public.template_assets
for delete
to authenticated
using (
  manager_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('master', 'manager', 'admin')
      and coalesce(p.account_status, 'active') not in ('disabled', 'suspended')
  )
);

-- Storage policies for session-RLS fallback. The normal production path should use SUPABASE_SERVICE_ROLE_KEY,
-- but these policies allow authenticated managers to manage files under manager/<auth.uid()>/...
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "xdisputer template asset storage select" on storage.objects;
    drop policy if exists "xdisputer template asset storage insert" on storage.objects;
    drop policy if exists "xdisputer template asset storage update" on storage.objects;
    drop policy if exists "xdisputer template asset storage delete" on storage.objects;

    create policy "xdisputer template asset storage select"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'template-assets'
      and (
        (storage.foldername(name))[1] = 'manager'
        and (
          (storage.foldername(name))[2] = auth.uid()::text
          or exists (
            select 1
            from public.manager_client_assignments mca
            where mca.client_user_id = auth.uid()
              and mca.manager_user_id::text = (storage.foldername(name))[2]
              and mca.status = 'active'
          )
        )
      )
    );

    create policy "xdisputer template asset storage insert"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'template-assets'
      and (storage.foldername(name))[1] = 'manager'
      and (storage.foldername(name))[2] = auth.uid()::text
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('master', 'manager', 'admin')
          and coalesce(p.account_status, 'active') not in ('disabled', 'suspended')
      )
    );

    create policy "xdisputer template asset storage update"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'template-assets'
      and (storage.foldername(name))[1] = 'manager'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    with check (
      bucket_id = 'template-assets'
      and (storage.foldername(name))[1] = 'manager'
      and (storage.foldername(name))[2] = auth.uid()::text
    );

    create policy "xdisputer template asset storage delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'template-assets'
      and (storage.foldername(name))[1] = 'manager'
      and (storage.foldername(name))[2] = auth.uid()::text
    );
  end if;
end $$;

notify pgrst, 'reload schema';

select
  to_regclass('public.template_assets') as template_assets_table,
  to_regclass('storage.objects') as storage_objects_table,
  to_regprocedure('public.app_activate_manager_template_asset_v1(uuid)') as activate_manager_template_rpc,
  to_regprocedure('public.app_manager_template_slot_status_v1(text)') as manager_template_status_rpc;
