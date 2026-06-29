# Master Workspace Retirement Canvas

## Decision

The Master Console no longer exposes Master UI Workspace or Master Workspaces as user-facing surfaces.

## Root cause

The master account had too many navigation surfaces: Monitoring, Accounts, Workspaces, UI Workspace, Reports, Audit, System, and Recovery. The extra workspace surfaces made the frontend harder to modify because master governance, account control, and experimental UI editing were split across overlapping routes.

## Permanent behavior

- Master Console navigation must not include `Workspaces`.
- Master Console navigation must not include `UI workspace`.
- `/master/workspaces` must redirect to `/master/accounts`.
- `/master/ui-workspace` must redirect to `/master`.
- `ConsoleShell` must not override master operations into `/master/ui-workspace`.
- Master pages should use Accounts, Reports, Audit log, System health, and Recovery ledger only.

## Isolation

Retired route files stay as small authenticated redirects so old bookmarks do not crash, but the heavy UI workspace shell is no longer loaded by active master navigation.

## Verification

```bash
npm run master-ui-workspace:guard
npm run manager-master-lightweight:guard
npm run ui-source:guard
npm run typecheck
npm run build
```
