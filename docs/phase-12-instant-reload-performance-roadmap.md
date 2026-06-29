# Phase 12 — Instant Reload Performance Roadmap

## Objective

Make xDisputer feel instant on refresh, navigation, template loading, and generation start while preserving the Phase 11 access model and generated document behavior.

## Confirmed Starting Point

- Phase 11D/11E SQL is deployed in production.
- Workspace-ledger access controls are active in code and can fall back to legacy RPCs only during rollout.
- No quota enforcement.
- No output limit enforcement.
- No destructive migration.
- No generated document rendering changes unless the change is isolated behind the performance lane and validated by the deploy guard.

## Biggest Gap

The biggest speed gap is the request and asset waterfall, not raw hosting power.

Current runtime can require multiple sequential steps before the user sees or uses the workspace:

1. Middleware checks Supabase auth and profile role for protected pages.
2. Server page code checks auth/profile again through session helpers.
3. Access entitlement may perform extra profile/manager reads.
4. The client workspace loads a large client component that imports DOCX/PDF/ZIP/storage workflow modules up front.
5. The client then fetches the template registry.
6. During generation, each missing local template can trigger a separate `/api/template-assets/file` request, each of which performs access checks, metadata lookup, and storage download.

The target architecture is a fast shell first, parallel data second, heavy document tooling only when needed.

## Top 3 High-Level Implementation Lanes

### 12A — Fast Shell + Session Snapshot

Goal: make protected pages paint immediately and remove repeated auth/profile reads.

- [ ] Add a lightweight authenticated shell/layout for `/workspace`, `/admin`, and `/master`.
- [ ] Create one session/access snapshot helper that returns user, profile, role, account status, manager state, and dashboard path in one call.
- [ ] Replace duplicated `requireWorkspaceAccess()` + `requireRole()` combinations with the snapshot.
- [ ] Add `loading.tsx` skeletons for `/workspace`, `/admin/access`, `/master/accounts`, and `/master/workspaces`.
- [ ] Use server streaming/Suspense boundaries for slow dashboard/account datasets.
- [ ] Keep protected routes secure; do not cache private user data globally.

Success signal:

- [ ] Refresh shows shell/skeleton without waiting for every Supabase read.
- [ ] Initial protected-page request performs one logical access read, not repeated profile/manager reads.
- [ ] Auth gating behavior remains unchanged.

### 12B — Template Manifest Prefetch + Client Cache

Goal: remove repeated template metadata/file downloads from the critical generation path.

- [ ] Add a single `/api/template-assets/manifest` endpoint that returns all active template metadata for the current user and selected round.
- [ ] Add a client-side `TemplateAssetCache` keyed by round, template kind, letter type/exhibit kind, asset id, and version number.
- [ ] Prefetch active templates after round selection or when Source Data becomes ready.
- [ ] Change generation to read templates from the in-memory cache first, then IndexedDB/local file cache second, then Supabase Storage last.
- [ ] Batch or parallelize remote template reads instead of fetching each template serially inside the route loop.
- [ ] Keep Supabase as source of truth; cache is only a performance layer and invalidates when asset id/version changes.

Success signal:

- [ ] Clicking Generate does not wait on several sequential template file requests when the manifest/cache is warm.
- [ ] Re-opening the same round is near-instant.
- [ ] Uploading/removing a template invalidates only the affected template slot.

### 12C — Split Heavy Document Tooling from Initial Bundle

Goal: stop DOCX/PDF/ZIP/editor modules from blocking the first workspace load.

- [ ] Dynamically import `JSZip`, DOCX renderers, PDF/finalization modules, and editor-only tooling only when the user generates, finalizes, or opens the editor.
- [ ] Split `LetterGeneratorWorkspaceV2` into route-level/panel-level client components: Dashboard, Templates, Source Data, Outputs, Filing Tracker, Settings.
- [ ] Load the Output editor only when `selected` is set.
- [ ] Keep `docx-preview` lazy; extend this pattern to ZIP/render/finalization utilities.
- [ ] Add bundle analysis to the deploy guard or a separate `performance:analyze` script.

Success signal:

- [ ] Workspace dashboard loads without downloading generation/editor/finalization code immediately.
- [ ] First interaction becomes responsive before heavy document tooling is needed.
- [ ] Bundle regression is visible before deploy.

## Investigation Checklist

### App Router / Vercel

- [ ] Verify which protected routes are fully dynamic and why.
- [ ] Add route-level loading states and streaming boundaries.
- [ ] Keep private data out of public CDN caches.
- [ ] Use prefetch/link navigation for known console routes.
- [ ] Add Web Vitals or Vercel Speed Insights tracking.

### Supabase / Database

- [ ] Run `EXPLAIN ANALYZE` for `access_workspace_account_summary_v1`.
- [ ] Run `EXPLAIN ANALYZE` for `access_workspace_account_directory_v1` views: overview, pending, active, blocked, managers, clients.
- [ ] Confirm indexes on `profiles.id`, `profiles.manager_id`, `profiles.role`, `profiles.account_status`.
- [ ] Confirm indexes on `workspace_members.workspace_id`, `workspace_members.profile_id`, `workspace_members.member_role`, `workspace_members.membership_status`.
- [ ] Confirm indexes on `client_manager_assignments.workspace_id`, `client_manager_assignments.client_id`, `client_manager_assignments.manager_id`, `client_manager_assignments.assignment_status`.
- [ ] Confirm RLS policies wrap stable JWT/helper functions with `select` where safe.
- [ ] Add explicit filters to every large query.

### Template Storage

- [ ] Measure `/api/template-assets?round=...` latency.
- [ ] Measure `/api/template-assets/file?...` latency per template slot.
- [ ] Consider signed URL download path for cached private template files if access rules remain correct.
- [ ] Add `Cache-Control: private` or browser-cache-safe headers only where asset versioning makes it safe.

### Client Runtime

- [ ] Measure initial JS payload size for `/workspace`.
- [ ] Measure time-to-interactive for `/workspace`.
- [ ] Measure generate-start delay separately from document rendering time.
- [ ] Move expensive source parsing/preflight to memoized or worker-backed paths if source files grow large.
- [ ] Consider a Web Worker for generation/finalization if main-thread blocking becomes visible.

## Implementation Order

1. **Measure first:** add lightweight Web Vitals and route timing logs.
2. **Fast shell:** add loading/skeleton and collapse duplicate auth/session reads.
3. **Template cache:** add manifest + prefetch + versioned client cache.
4. **Bundle split:** lazy-load ZIP/DOCX/PDF/editor modules.
5. **Database tune:** add indexes or RPC refinements from real `EXPLAIN ANALYZE` results.

## Guardrails

- Do not weaken auth or workspace access checks.
- Do not cache private account/template data in public caches.
- Do not change generated DOCX/PDF output shape while optimizing load speed.
- Do not add quotas or output limits.
- Keep Phase 12 changes incremental and independently deployable.

## Deployment Checklist

- [ ] `git pull --rebase origin main`
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run xdisputer:guard`
- [ ] Verify `/workspace` refresh.
- [ ] Verify `/admin/access` refresh and control action return.
- [ ] Verify `/master/accounts` refresh.
- [ ] Verify template upload/remove still syncs to Supabase.
- [ ] Verify Generate produces identical packet structure.
- [ ] Verify final ZIP generation still works.
