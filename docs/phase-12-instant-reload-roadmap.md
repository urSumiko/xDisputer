# Phase 12 — Instant Reload + Zero-Delay Runtime Roadmap

## Objective

Make xDisputer feel instant after the Phase 11D/11E workspace-ledger deployment by reducing blocking server work, eliminating avoidable full-page reloads, and caching stable per-user/workspace data safely.

Target experience:

- Protected console navigation should show a shell immediately.
- Account actions should update the visible UI without a full page wait whenever possible.
- Workspace template metadata should load once per round and avoid repeated server/storage hops.
- Heavy DOCX/PDF/ZIP work should not block normal navigation or account-control pages.

## Current Diagnosis

Phase 11D/11E is deployed. The biggest remaining gap is no longer missing SQL. The likely bottleneck is the runtime shape:

1. Older `/master` and `/admin` dashboards still rely on broad account reads and TypeScript-side filtering.
2. Several protected routes perform session/profile/access checks before the UI shell can render.
3. Template generation still downloads template files on demand and then performs heavy client-side DOCX/ZIP work.
4. Control forms submit through POST redirects, which creates a reliable but not instant UX.
5. The repo has safety-first no-store behavior for private/API areas; this is correct for sensitive data but means the app needs selective private caching and streaming rather than blanket cache removal.

## Top 3 High-Level Implementations

### Phase 12A — Server Read Compression

Replace broad dashboard reads with existing/new workspace summary RPCs.

- [x] Route `/master` monitoring cards through `access_workspace_account_summary_v1(...)` instead of loading all profiles and filtering in TypeScript.
- [x] Route `/admin` monitoring cards through `access_workspace_account_summary_v1(...)` / manager-scoped RPC output instead of `listManagedAccounts(...)` broad reads.
- [x] Add compact `access_workspace_attention_queue_v1(...)` RPC for only the rows needed by dashboard snapshots.
- [x] Add safe Phase 12 indexes for workspace members, assignment ledger, profiles, template assets, and generation runs.
- [x] Keep `/master/accounts` and `/admin/access` as the canonical paginated directory pages.
- [x] Add `docs/phase-12-supabase-performance-validation.sql` for `explain analyze` validation.
- [ ] Run Phase 12 Supabase SQL in production.
- [ ] Paste and review `explain (analyze, buffers)` output after production SQL is applied.

Success target:

- Dashboard initial data should be one context check + compact RPC reads, not broad profile download + in-memory filtering.

### Phase 12B — Instant Shell + Streaming Private Data

Make navigation feel immediate even when private data must remain fresh.

- [x] Add `loading.tsx` skeletons for `/master`, `/master/accounts`, `/admin`, `/admin/access`, `/workspace`, `/system/templates`, and `/system/runtime`.
- [~] Split slow server components into route-level loading shells first; deeper Suspense data islands can follow if telemetry still shows slow sections.
- [x] Keep the sidebar/header shell renderable before account tables finish.
- [x] Keep sensitive pages private/no-store, but show loading shells instead of a blank wait.
- [ ] Add route-level duration logging so slow sections are visible in the system event ledger.

Success target:

- User sees usable navigation shell immediately; slow database sections stream in without a blank wait.

### Phase 12C — Optimistic Control + Template Runtime Cache

Upgrade existing functions instead of replacing them.

- [~] Add `OptimisticControlForm` client component that preserves `/api/control/profile` as the native form fallback. Full adoption in every account-control table is still pending because connector safety blocked direct rewrites of some control files.
- [x] Add pending/success/error state support for enhanced control buttons.
- [ ] After successful control, refresh only the affected card/table dataset instead of forcing broad page reload behavior.
- [ ] Cache template registry metadata per user + round on the client with a short TTL and explicit invalidation after upload/delete.
- [~] Add private ETag/cache headers for Supabase template file downloads to reduce repeated template file transfer.
- [x] Preserve generated document output behavior.

Success target:

- Account controls begin moving toward instant UX and generation avoids repeated template file transfer where browser/private caching is honored.

## Advanced Method to Deploy

Implement as additive runtime enhancements only:

1. Add Phase 12 observability first.
2. Replace broad dashboard reads with compact RPC reads.
3. Add loading skeletons and Suspense data islands.
4. Add optimistic control UI on top of existing route handler.
5. Add client-side template metadata/file memoization with explicit invalidation.
6. Run `npm run xdisputer:guard`.
7. Deploy through `./scripts/safe-ship.sh "feat: improve instant reload runtime"`.

## Supabase SQL Files

- `supabase/migrations/20260612021000_phase_12_instant_reload_performance.sql` — apply in Supabase SQL Editor.
- `docs/phase-12-supabase-performance-validation.sql` — run after applying the migration to verify RPCs, indexes, and query plans.

## Non-Negotiable Rules

- Do not remove Phase 11D/11E fallback safety unless production has been verified over time.
- Do not weaken protected route access checks.
- Do not cache private data publicly.
- Do not change generated document output behavior.
- Do not add quota/output enforcement.
- Do not introduce destructive migrations.

## Verification Checklist

- [x] `/master` opens with immediate shell/skeleton.
- [x] `/admin` opens with immediate shell/skeleton.
- [x] `/master/accounts` has a route loading state and remains the paginated account directory.
- [x] `/admin/access` has a route loading state and remains the manager client directory.
- [ ] Apply Phase 12 Supabase performance SQL in production.
- [ ] Run validation SQL and review `explain analyze` output.
- [ ] Approve/reject/reactivate feels instant and writes assignment events.
- [~] Template file downloads now include private ETag/cache headers; active-round client memoization remains pending.
- [x] Generation output remains byte/order compatible with current behavior.
- [ ] Supabase query plans for dashboard RPCs avoid avoidable broad scans.
