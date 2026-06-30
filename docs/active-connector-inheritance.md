# xDisputer active connector inheritance

_Last updated: 2026-06-30 Asia/Manila_

## Purpose

This file is the repo-level contract for the active xDisputer source, local sync process, and Supabase SQL review process.

## Active binding

| Area | Active state | Boundary |
| --- | --- | --- |
| GitHub repository | `urSumiko/xDisputer` on `main`; prompt aliases `urSumiko/xDispute` and `xDispute.code` map here. | Local sync must verify `origin` ends with `urSumiko/xDisputer.git`. |
| Supabase | Project is selected through local/deployment environment variables and reviewed SQL. | Do not commit secrets. Generate a manual SQL bundle, review it, then run it in the Supabase SQL Editor. |
| Current library docs | Use current official/package documentation when implementation depends on version-specific behavior. | Do not guess behavior for recently changed packages. |

## Active local commands

The active local runner file is `scripts/xdisputer-active-sync.sh`.

Use this when local/Codespace work should match current `main` and run verification:

```bash
npm run active:sync -- --reset-local --verify
```

Use this when local changes should be saved into a stash before sync:

```bash
npm run active:sync -- --stash-local --verify
```

Use this when the Supabase target is confirmed and you need a reviewed manual SQL bundle:

```bash
npm run active:sync:db
```

Use this for only the active contract check:

```bash
npm run connection-inheritance:guard
```

## SQL validation

After running reviewed SQL in the Supabase SQL Editor, run `docs/xdisputer-connection-validation.sql` in the same SQL Editor.

Expected result: every required RPC and table check returns the expected `public.*` object, and the required performance index query returns eight rows.

## Implementation contract

1. Trace the latest changepoint before coding.
2. Bind to `urSumiko/xDisputer` and `main`.
3. Run `npm run connections:doctor` before root-cause debugging.
4. Use Supabase migrations or generated reviewed SQL; do not commit `.env.local` or secrets.
5. Use current package docs for version-sensitive framework behavior.
6. Report exact files changed, terminal commands, SQL commands, and expected result after every coded pass.
