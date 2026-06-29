# CSS Retirement Map

## Purpose

This map turns root CSS reduction from the modernization canvas into a controlled migration instead of more global overrides.

## Current owners

| Surface | Owner file | Rule |
| --- | --- | --- |
| Client account dock | `app/client-account-popover-ratio.css` | Owns canonical client account dock and hides duplicate header entitlement. |
| Client workspace geometry | `app/client-workspace-layout-lock.css` | Owns dashboard card geometry, metrics, recent-work rows, and content max width. |
| Shared account rail | `app/account-menu-ratio-system.css` | Owns shared manager/master/client account dock behavior. |
| Debug overlay | `app/console-debug-overlay.css` | Owns runtime proof/debug overlay only. |

## Retirement order

1. Audit client dashboard selectors that overlap `client-workspace-layout-lock.css`.
2. Move one surface at a time into feature-owned CSS or component-level classes.
3. Add a guard before removing any legacy selector.
4. Remove duplicate rules only after `npm run ui-source:guard`, `npm run typecheck`, and `npm run build` pass.

## Verification

```bash
node scripts/css-ownership-guard.mjs
npm run ui-source:guard
npm run typecheck
npm run build
```
