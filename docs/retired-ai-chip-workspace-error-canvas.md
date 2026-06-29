# Retired AI / Chip / Workspace Error Canvas

## Main cause

Large inline terminal commands caused shell quoting and substitution failures. Separate guard files also kept stale expectations for retired UI surfaces.

## Retired surfaces

- AI assistant layer
- lib/ai backend modules
- /api/ai route
- output-limit and entitlement compact chips
- Master UI Workspace user navigation
- Master Workspaces user navigation

## Correct durable action

Use stable script files for repair logic. Avoid giant inline one-liners for code generation.

## Verification

```bash
npm run assistant-chip-retirement:guard
npm run client-account:guard
npm run client-critical:guard
npm run css-ownership:guard
npm run performance:guard
npm run ui-source:guard
npm run typecheck
npm run build
```
