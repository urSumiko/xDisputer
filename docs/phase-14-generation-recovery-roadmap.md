# Phase 14 — Generation Snapshot, Recovery, and Template Manifest Cache

## Objective

Harden the current xDisputer runtime without weakening Phase 11/12 access controls:

1. Persist a non-blocking generation snapshot ledger.
2. Persist generation error events for recovery review.
3. Add a template manifest endpoint that lets the workspace hydrate all active template metadata in one request.
4. Patch the workspace to use version-keyed in-memory template blob caching before repeated file downloads.

## What is coded

- `supabase/migrations/20260613033000_phase_14_generation_snapshots_recovery.sql`
  - Adds `generation_run_snapshots`.
  - Adds `generation_error_events`.
  - Adds `app_record_generation_run_snapshot`.
  - Adds `app_record_generation_error_event`.
  - Adds master-only read RPCs for snapshots and generation errors.

- `lib/saas/generation-snapshots.ts`
  - Adds non-blocking snapshot and error logging helpers.
  - Stores hashes and compact metadata instead of raw source text by default.

- `app/api/template-assets/manifest/route.ts`
  - Returns all active template metadata for the authenticated user and selected round.
  - Provides stable `cache_key`, `slot_key`, and `file_url` values.
  - Uses private/no-store response headers and keeps Supabase as source of truth.

- `app/master/recovery/page.tsx`
  - Adds a master-only recovery ledger view for snapshots and generation error events.

- `scripts/repair-phase14-generation-snapshots.mjs`
  - Patches `/api/generation-runs` to record snapshots and recovery errors without blocking generation.
  - Patches `LetterGeneratorWorkspaceV2` to use `/api/template-assets/manifest` and version-keyed in-memory blob caching.

## Guardrails preserved

- No quota logic added.
- No output limit behavior changed.
- No generated DOCX/PDF output shape changed.
- No public caching for private template or account data.
- Snapshot/error recording is best-effort only and must not block generation.

## Deploy order

1. Pull the latest `main`.
2. Run the SQL migration in Supabase.
3. Run the repair script locally once, or let `npm run typecheck` / `npm run build` run it through the package pre-hooks.
4. Run typecheck, build, and deploy guard.
5. Trigger Vercel production sync.

## Verification signals

- `/api/template-assets/manifest?round=1st%20Round` returns active template metadata for the signed-in user.
- Generating a packet still produces the same output structure.
- `/master/recovery` shows new snapshot/error ledgers after generation.
- Re-generating with the same active templates reuses the in-memory blob cache during the browser session.
