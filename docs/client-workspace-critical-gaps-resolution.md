# Client Workspace Critical Gaps Resolution

## User request

Code all top five critical gaps after moving the client account menu toward the manager/master account menu standard.

## What changed

1. The client workspace now mounts the canonical `AccountMenu` component used by manager/master.
2. The canonical account menu now supports `client` role labels and client workspace surface text.
3. The client account CSS now uses the canonical account dock contract instead of fixed-card imitation.
4. Duplicate output-limit rendering is controlled: the dashboard command card is the primary entitlement surface and the top header entitlement is hidden.
5. Client workspace critical gaps, dashboard surface behavior, and CSS ownership are now represented as feature contracts.
6. A `client-critical:guard` script verifies the critical gaps and is wired into `client-account:guard`, which is already part of `ui-source:guard`.

## Files changed

- `components/console/AccountMenu.tsx`
- `components/LetterGeneratorWorkspaceV2.tsx`
- `app/client-account-popover-ratio.css`
- `src/features/client-workspace/client-workspace-contract.ts`
- `src/features/client-workspace/client-dashboard-surface.ts`
- `src/features/client-workspace/client-css-ownership.ts`
- `scripts/client-critical-gaps-guard.mjs`
- `package.json`

## Gap status

| Gap | Status | Implementation |
| --- | --- | --- |
| Large client workspace component | Controlled | Feature contracts and canonical shell markers are in place; full JSX extraction remains staged. |
| Dashboard duplicate header layers | Controlled | Header entitlement is hidden; dashboard command card owns the output-limit widget. |
| Client not using manager/master account menu layout | Closed | Client now uses canonical `AccountMenu` with `role="client"`. |
| Canvas modernization pending slices | Controlled | Client workspace contracts and guards make the remaining slices explicit. |
| CSS cascade conflicts | Controlled | Client account CSS owns only client account dock cleanup; layout lock owns dashboard geometry. |

## Verification

```bash
npm run client-critical:guard
npm run client-account:guard
npm run ui-source:guard
npm run typecheck
npm run build
```

## Expected UI result

The `/workspace` client dashboard should no longer use the legacy sidebar account card. It should render the shared account dock in the header ratio grid, with the dashboard command card owning the output-limit widget.
