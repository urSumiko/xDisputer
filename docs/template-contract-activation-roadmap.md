# Template Contract Activation Tracker

_Last updated: 2026-06-17 Asia/Tokyo_

## Goal

Preserve user-uploaded template layout while making generated output consistent through one canonical source-data and template-contract workflow.

## Current coded foundation

- `lib/template-contracts.ts` defines canonical fields, aliases, required fields by document kind, validation status, confidence, and what-if guidance.
- `lib/round-template-policy.ts` defines per-round intent, strictness, required letters, required exhibits, and packet order.
- `lib/preflight-validation.ts` now blocks generation when source data, routes, templates, evidence, affidavit data, custom fields, or active template contracts are incomplete.
- `lib/supabase/template-registry.ts` models owner-scoped, round-scoped, versioned template assets and now exposes a latest-active slot resolver.
- `app/api/template-assets/route.ts` now inspects uploaded template contracts, blocks `BLOCKED` contracts before storage, computes `content_hash`, stores `validation_json`, detects duplicate active uploads, and archives superseded versions instead of immediately deleting them.
- `app/api/template-assets/manifest/route.ts` now resolves one latest active template per owner + round + slot and reports duplicate active slot diagnostics.
- `lib/generation-manifest.ts` now supports source hash, source summary, template provenance, template validation state, template versions, content hashes, outputs, warnings, and packet order.
- `components/LetterGeneratorWorkspaceV2.tsx` now hydrates browser generation manifests from effective Supabase-backed letter references and exhibit templates.
- `scripts/template-provenance-workspace-guard.mjs` guards that workspace manifest provenance keeps asset ID, version, content hash, validation JSON, effective references, and effective templates wired.
- `supabase/migrations/20260613062000_template_asset_active_slot_guard.sql` adds database-level duplicate active-slot cleanup plus a unique active-slot guard.
- `supabase/migrations/20260613062500_template_asset_retention_candidates.sql` adds a read-only retention candidate view for archived templates beyond the newest two archived versions per slot.
- `app/api/template-assets/retention/route.ts` exposes read-only owner-scoped retention candidates for future cleanup UI.

## Enhancement roadmap

| Step | Status | Target | Why |
| --- | --- | --- | --- |
| 1 | Coded | Template contract inspection | Let different layouts share the same canonical meaning. |
| 2 | Mostly coded | Contract activation gate | Blocked templates fail before storage; DB unique active-slot guard is coded. Atomic activation RPC is still pending. |
| 3 | Coded | Content hash on upload | Avoid duplicate active storage and improve traceability. |
| 4 | Coded | Validation JSON on asset row | Store why a template was accepted, warned, or blocked. |
| 5 | Coded | Latest-active slot resolver | Manifest hydration now selects the latest active asset per owner + round + slot. |
| 6 | Mostly coded | Restore-window retention | Superseded versions are archived; retention candidates are visible. Destructive cleanup remains manual/pending. |
| 7 | Coded | Preflight contract checks | Generation now blocks active templates with missing canonical fields or unknown required fields. |
| 8 | Coded | Generation manifest | Browser ZIP and persisted generation manifests receive effective Supabase-backed template metadata. |
| 9 | Coded | Workspace provenance guard | Repo checks can now verify the browser workspace keeps template provenance wired. |

## Production rules

1. Templates may change wording, format, order, and sections.
2. Templates must preserve canonical anchors for required meaning.
3. Latest valid upload becomes active.
4. Invalid upload must not replace the previous active template.
5. User-owned templates must never bleed across users or rounds.
6. Generation should either produce deterministic output or block with a clear reason.
7. Storage should keep active template plus archived metadata; destructive cleanup should run only through an explicit manual or database-backed retention policy.
8. Browser-generated manifests must preserve Supabase-backed template proof when manager template assets override local browser templates.

## What-if matrix

| Scenario | Required behavior | Current state |
| --- | --- | --- |
| Wording changes but placeholders remain | Allow upload and preserve layout. | Supported by contract aliases/placeholders. |
| Section order changes but placeholders remain | Allow upload and preserve layout. | Supported by contract inspection. |
| Client name anchor is removed | Block activation. | Coded through upload gate and preflight contract checks. |
| Account lines anchor is removed from dispute/late-payment letter | Block activation. | Coded through required canonical fields and preflight contract checks. |
| Alias changes from `client_name` to `consumer_name` | Allow if alias maps to `client.name`. | Supported by alias mapping. |
| Custom required field is added | Block generation until mapped or completed. | Upload contract detects; preflight custom readiness handles workspace values. |
| Wrong file type is uploaded | Reject before storage. | Coded. |
| Duplicate active file is uploaded | Reuse active version metadata and avoid duplicate storage. | Coded when `content_hash` is present. |
| New upload is invalid | Keep previous active version. | Coded because invalid upload is blocked before storage/insert. |
| Multiple active rows exist for one slot | Manifest chooses latest active; SQL migration normalizes duplicates and adds a unique active-slot guard. | Coded. |
| Old active template lacks contract metadata | Generation preflight warns and asks for re-upload/rescan before production use. | Coded. |
| Generated output must be explainable later | Manifest builder records source and template proof fields. | Coded and guarded. |
| Many old versions exist | Archive superseded versions; retention view/API shows cleanup candidates beyond the newest two archived versions per slot. | Mostly coded. |

## Expected implementation outcome

The renderer remains dynamic-template-first, but every generation follows this path:

```text
canonical source packet
+ active template contract
+ round policy
+ preflight proof
+ generation manifest
= consistent output or clear blocker
```

## Next coding step

Atomic activation RPC and destructive storage cleanup remain optional Supabase hardening steps. The browser workspace manifest wiring is now coded and protected by `scripts/template-provenance-workspace-guard.mjs`.
