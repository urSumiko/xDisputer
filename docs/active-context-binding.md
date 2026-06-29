# xDisputer active context binding

_Last updated: 2026-06-30_

## Active repository

- GitHub repository: `urSumiko/xDisputer`
- User prompt aliases observed: `urSumiko/xDispute`, `xDisputer`
- Default branch: `main`
- Codespace path: `/workspaces/xDisputer`
- Supabase target: project connected through existing environment variables and migrations.

## Current active technical state

- App framework: Next.js with React.
- Supabase packages are installed through `@supabase/ssr` and `@supabase/supabase-js`.
- Active package scripts now route connection checks through `npm run connections:doctor`.
- Connection doctor exists at `scripts/check-env-contract.mjs`.
- Connection inheritance: see `docs/active-connector-inheritance.md`.
- Browser Supabase runtime accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` and falls back to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Active Supabase/RPC layer

The active account directory flow is Supabase-backed and should continue through these read RPC contracts:

- `public.access_workspace_account_summary_v1(uuid)`
- `public.access_workspace_account_directory_v1(uuid, text, text, integer, integer)`
- `public.access_workspace_attention_queue_v1(uuid, integer)`

These contracts power:

- `getMasterAccountSummary`
- `listMasterAccountDirectory`
- `listMasterAttentionQueue`
- `getManagerClientSummary`
- `listManagerClientDirectory`
- `listManagerAttentionQueue`

## Non-negotiable behavior constraints

- Keep manager/client generation unrestricted by quota logic.
- Keep Supabase migrations additive unless a root-cause fix explicitly requires controlled replacement of a broken function signature.
- Avoid destructive table changes unless the user explicitly approves a data migration plan.
- Use root-cause tracing before UI rewrites.
- Do not let optional browser notification startup crash the root layout when Supabase browser env keys are missing locally.

## Roadmap checkpoint

| Area | Current status | Next logical action |
| --- | --- | --- |
| Repository binding | Active repository identified as `urSumiko/xDisputer`. | Pull `origin/main` in Codespaces and run `npm run connections:doctor`. |
| Supabase | Multi-tenant workspace RPC migrations exist. | Run DB push/migration status and SQL validation. |
| Generation reliability | Workflow framework export is present. | Keep generation contract single-source and avoid duplicate packet order declarations. |
| Error prevention | Error ledger now exists. | Update it whenever a root cause is found, before applying another patch. |
| Browser env stability | Notification startup no longer throws through `RootLayout` when browser Supabase env is absent. | Add `.env.local`, restart Next.js, and run the guard chain. |

## Required local sequence

Pull `main`, install dependencies, run `npm run connections:doctor`, run `npm run typecheck`, then run `npm run build`.

## Required database validation sequence

Run `docs/xdisputer-connection-validation.sql` in the Supabase SQL Editor after migrations are pushed.
