# xDisputer active connector inheritance

_Last updated: 2026-06-17 Asia/Tokyo_

## Purpose

This file is the repo-level inheritance contract for the connected toolchain used on `Arisu-art/xDisputer`.

It prevents future work from guessing the active repository, database target, design target, or documentation source when a task asks to connect the repo, sync, reset local work, or inherit the active process.

## Active binding

| Connector | Active state | Boundary |
| --- | --- | --- |
| GitHub | `Arisu-art/xDisputer` on `main`; prompt alias `Arisu-art/xDispute` maps here. | Local sync must verify `origin` ends with `Arisu-art/xDisputer.git`. |
| Supabase | Project is selected through the local Supabase link and public runtime env keys. | Schema changes must use migrations or reviewed SQL. |
| Figma | Connector is available for design-to-code and Code Connect workflows. | Code Connect mappings require a Figma URL with `fileKey` and `node-id`. |
| Context7 | Documentation lookup is available for current library/framework behavior. | Resolve the library ID first, then query docs for implementation-sensitive package behavior. |

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

Use this when the linked Supabase target has been confirmed and pending migrations should be pushed:

```bash
npm run active:sync:db
```

Use this for only the connector inheritance check:

```bash
npm run connection-inheritance:guard
```

## SQL validation

After a Supabase migration push, run `docs/xdisputer-connection-validation.sql` in the Supabase SQL Editor.

Expected result: every required RPC and table check returns the expected `public.*` object, and the required performance index query returns eight rows.

## Implementation contract

1. Trace the latest changepoint before coding.
2. Bind to `Arisu-art/xDisputer` and `main`.
3. Run `npm run connections:doctor` before root-cause debugging.
4. Use Supabase migrations for schema changes and SQL Editor for validation or reviewed SQL.
5. Use Figma only with concrete file/node identifiers.
6. Use Context7 for current framework/package details when implementation depends on current docs.
7. Report exact files changed, terminal commands, SQL commands, and expected result after every coded pass.
