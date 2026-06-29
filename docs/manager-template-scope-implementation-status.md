# Manager Template Scope Implementation Status

## Goal

Manager-owned templates are the default templates for every client assigned to that manager. Clients use those manager defaults for all rounds and dynamic template outputs. Clients do not upload, replace, remove, or override templates.

## Roadmap status

| Phase | Status | Notes |
|---|---|---|
| 0. Role and scope helper | Coded | `resolveManagerTemplateScope` resolves manager self, master self, or assigned manager. |
| 1. Assignment schema | Coded | `manager_client_assignments` plus backfill from `profiles.manager_id`. |
| 2. Manager-scoped template assets | Coded | `manager_user_id`, `uploaded_by_user_id`, `template_scope`, manager active-slot uniqueness. |
| 3. Upload/delete/activation restriction | Coded | `/api/template-assets` blocks clients and writes manager metadata. |
| 4. Template file and manifest resolution | Coded | `/api/template-assets/file` and `/api/template-assets/manifest` resolve assigned-manager templates. |
| 5. Client read-only template UI | Coded | Client template controls show manager-controlled/read-only state and use manager defaults. |
| 6. Manager template control UI | Coded | Existing Templates workspace is manager control UI; `/system/manager-templates` is the manager library entry point. |
| 7. Error flyout expansion | Coded | `MANAGER_TEMPLATE` category covers assignment missing, upload locked, and missing manager templates. |
| 8. Generation manifest proof | Coded | Manifest v1.2.0 records manager template provenance, asset ids, hashes, manager ids. |
| 9. Regression guards | Coded | Manager scope guard and manager UI guard verify storage, API, UI, and manifest wiring. |

## Coded files

- `lib/manager-template-scope.ts`
- `lib/manager-template-ui.ts`
- `lib/manager-template-library.ts`
- `lib/supabase/template-registry.ts`
- `lib/supabase/template-storage-service.ts`
- `lib/user-facing-error.ts`
- `lib/generation-manifest.ts`
- `app/api/template-assets/route.ts`
- `app/api/template-assets/file/route.ts`
- `app/api/template-assets/manifest/route.ts`
- `app/system/manager-templates/page.tsx`
- `components/TemplateProgressiveWorkspace.tsx`
- `components/ManagerTemplateLibraryDashboard.tsx`
- `scripts/apply-manager-template-storage-wiring.mjs`
- `scripts/apply-manager-template-ui-wiring.mjs`
- `scripts/phase14-local-safety-check.mjs`
- `scripts/manager-template-scope-guard.mjs`
- `scripts/manager-template-ui-guard.mjs`
- `supabase/migrations/20260614101000_manager_template_scope.sql`
- `supabase/sql/manager_template_public_schema_only.sql`

## Database status

Run `supabase/sql/manager_template_public_schema_only.sql` in Supabase SQL Editor. Do not run `storage.objects` policy SQL in SQL Editor because hosted Supabase owns that table.

## Storage status

Template storage is routed through `lib/supabase/template-storage-service.ts`. It uses `SUPABASE_SERVICE_ROLE_KEY` on the server when available, which avoids relying on direct client ownership of `storage.objects` policies.

## Remaining non-blocking enhancement

A deeper manager analytics page with per-client names and per-slot affected-client drilldown can be added later. The required manager-template authority model is coded now.

## Production behavior expected

- Manager uploads default templates.
- All assigned clients use those manager defaults.
- Clients cannot upload templates through the API.
- Client UI shows manager-controlled template state.
- Generation uses manager template assets and records manager provenance in `generation-manifest.json`.
