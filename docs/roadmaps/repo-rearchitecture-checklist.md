# xDisputer Repo Re-architecture Checklist

## Top 6 active fixes

- [x] Fix 1 — stable cleanup entrypoint
  - File: scripts/finalize-retired-surface-cleanup.mjs
  - Goal: one deterministic local repair path, no giant pasted terminal code.

- [x] Fix 2 — route convention normalization
  - Files: proxy.ts, deprecated middleware.ts removed by cleanup
  - Goal: align with Next.js 16 proxy convention.

- [x] Fix 3 — client account CSS repair
  - Files: app/client-account-popover-ratio.css, app/account-popover-compact-retirement.css
  - Goal: valid client account dock CSS with no retired chip selectors.

- [x] Fix 4 — client layout CSS repair
  - File: app/client-workspace-layout-lock.css
  - Goal: valid layout CSS with owned dashboard geometry and no brace corruption.

- [x] Fix 5 — contract-driven guard alignment
  - Files: scripts/assistant-chip-retirement-guard.mjs, scripts/client-account-popover-guard.mjs, scripts/client-critical-gaps-guard.mjs, scripts/css-ownership-guard.mjs, src/features/client-workspace/client-dashboard-surface.ts, src/features/client-workspace/client-css-ownership.ts
  - Goal: guards verify current product truth instead of legacy hidden-chip behavior.

- [x] Fix 6 — roadmap + tracker enforcement
  - Files: docs/roadmaps/repo-rearchitecture-checklist.md, scripts/repo-rearchitecture-roadmap-guard.mjs
  - Goal: every cleanup phase is traceable and checkable.

## Next roadmap phases

- [x] Phase 7 — root CSS import reduction
  - Files: app/layout.tsx, app/root-css-workspace-foundation.css, app/root-css-template-pipeline.css, app/root-css-client-portal.css, app/root-css-console-shell.css, app/root-css-contracts.css, scripts/root-css-import-reduction-guard.mjs
  - Goal: reduce root layout global CSS entrypoints to a small ordered set while preserving deterministic cascade order.
- [x] Phase 8 — notification ownership isolation
  - Files: components/notifications/OwnedNotificationDock.tsx, src/features/notifications/notification-ownership-contract.ts, src/features/notifications/notification-api-service.ts, scripts/notification-ui-frontend-guard.mjs
  - Goal: keep notification UI, read flow, and polling fully owned by the account rail notification surface.
- [x] Phase 9 — backend route/service contract audit
  - Files: app/api/notifications/read/route.ts, app/api/manager-output-decision/route.ts, src/features/notifications/notification-api-service.ts, src/features/manager-output-activity/manager-output-decision-service.ts, scripts/backend-route-service-contract-guard.mjs
  - Goal: move route business logic behind reusable services and verify delegation with guards.
- [x] Phase 10 — delete temporary compatibility layers after verification
  - Files: lib/notifications/notification-service.ts, lib/notifications/notification-write-service.ts, src/features/account-rail/account-rail-contract.ts, scripts/compatibility-layer-retirement-guard.mjs
  - Goal: remove notification schema compatibility fallbacks and old notification surface layers after verified schema alignment.
