# xDisputer Active State and Error Log

_Last updated: 2026-06-13 Asia/Manila_

## Active repository binding

- Requested repository alias: `Arisu-art/xDispute`
- Resolved active GitHub repository: `Arisu-art/xDisputer`
- Default branch: `main`
- Active deployment target: Vercel production, configured through repository and environment variables.
- Active data/auth target: Supabase, configured through repository and environment variables.

## Current roadmap position

The project is in the document-operations migration track. The current active roadmap document is `docs/phase-14-generation-recovery-roadmap.md`.

### Coded foundations already present

- Authoritative generation contract.
- Workflow framework facade.
- Preflight validation contract.
- Document generation service contract.
- Operation state contract.
- Browser storage adapter contract.
- Document worker contract.
- AI change-control policy.
- GitHub quality gate.
- Phase 14 generation snapshots, recovery ledger, and template manifest cache plan.

### Current implementation priority

1. Keep current UI behavior stable.
2. Do not let retired or backup UI paths render in production.
3. Keep packet order sourced from `lib/generation-contract.ts`.
4. Keep workflow exports sourced from `lib/workflow-framework.ts` using the active exported names.
5. Keep Supabase work gated behind access control and retention rules.
6. Run `npm run xdisputer:guard` before trusting deploy state.

## Known errors and lessons learned

### 1. JSX/template parse break in `app/page.tsx`

- Symptom: `app/page.tsx` failed to parse around literal template markers such as fraud-item loop markers.
- Cause: embedding template syntax directly inside JSX/template expressions created parser ambiguity.
- Prevention: keep public page JSX simple; render literal document-template markers through safe strings/constants outside JSX expression tricks when needed.
- Current observed active state: `app/page.tsx` is a compact SaaS public landing page and no longer contains those problematic markers.

### 2. Workflow export drift in `lib/workflow-framework.ts`

- Symptom: imports referenced names that were not exported, including old exhibit helper names; another failure referenced workflow framework import/export mismatch.
- Cause: refactors renamed active workflow helpers without updating all import sites.
- Prevention: use the current active exports only: `workflowFramework`, `packetWorkflows`, `getPacketPositions`, `packetOrderLabels`, `packetOrderText`, `packetPositionCount`, and `exhibitKindsForPacket`.
- Current observed active state: `workflowFramework` and `exhibitKindsForPacket` are exported.

### 3. GitHub commit search qualifier-only failure

- Symptom: GitHub search returned validation failure when searching commits with only repository qualifiers.
- Cause: GitHub commit search requires searchable text, not qualifiers only.
- Prevention: include a real text term with repository scoping.

### 4. Missing durable active-state log

- Symptom: this file was not present.
- Cause: project state and known error history were spread across chat memory, docs, and prior file context.
- Prevention: maintain this file after each repo-level remediation so future work starts from the active state instead of repeating old fixes.

## Sync commands

Use this sequence from the Codespace or local clone before editing:

```bash
git remote -v
git fetch origin main
git status --short
git pull --rebase origin main
npm ci
npm run xdisputer:guard
```

If local changes exist and must be preserved automatically:

```bash
bash scripts/safe-sync-guard.sh
```

## Supabase migration sync

Run pending migrations through the Supabase CLI when linked:

```bash
supabase migration list
supabase db push
```

Manual SQL editor fallback for Phase 14:

```sql
-- Run the contents of this repository migration in Supabase SQL editor:
-- supabase/migrations/20260613033000_phase_14_generation_snapshots_recovery.sql
-- Use this only if CLI migration sync is unavailable.
```

## Vercel production sync and verification

After GitHub `main` is updated and Supabase migrations are applied:

```bash
npm run vercel:status || true
npm run verify:production:wait
npm run production:match
```

If Git integration build is unavailable or rate-limited and Vercel CLI is configured in the Codespace:

```bash
npm run vercel:direct
```

## Expected chat outcome after this log update

- The repo has a single durable active-state and error-prevention file.
- Future changes should start by checking this file plus the current roadmap doc.
- Old UI/code paths must be explicitly marked as retired when replaced so they cannot silently render in production.
- New implementation work should include terminal commands and SQL commands in the chat response when deployment/database sync is relevant.
