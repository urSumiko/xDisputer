# Retired Entitlement Chip Guard Loop Root Cause

## Main cause

The compact entitlement/output chip was removed from UI code, but one client guard still enforced the old behavior:

- duplicate header entitlement selector must exist
- dashboard entitlement selector must exist

That created a loop where each cleanup exposed another stale guard expectation.

## Correct product contract

The entitlement/output chip is retired everywhere. It is not hidden. It is not active. It should not exist in:

- client header CSS
- dashboard command card CSS
- dashboard React component
- client workspace React component
- guard source exact marker literals

## Files updated

- `src/features/client-workspace/client-dashboard-surface.ts`
- `scripts/client-critical-gaps-guard.mjs`

## Verification

```bash
npm run client-account:guard
npm run client-critical:guard
npm run assistant-chip-retirement:guard
npm run ui-source:guard
npm run typecheck
npm run build
```

## Future rule

When a UI surface is retired, update the source contract and all guards in the same change. Never preserve hidden selectors for removed UI.
