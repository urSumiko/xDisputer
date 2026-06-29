# Performance Boost Canvas

## Goal

Make xDisputer faster by reducing page work, avoiding duplicate frontend ownership, and keeping heavy work out of the first render path.

## Findings from the repo scan

1. The runtime debug panel can load during ordinary development browsing.
2. Notification and entitlement features use browser timers, so ownership and frequency must stay controlled.
3. PDF, DOCX, canvas, and template libraries must remain behind user action, server work, or dynamic loading.
4. Many root CSS files can compete for layout ownership.
5. Supabase queries must select only needed columns, filter after select, and limit rows.

## Performance contract

Every change should follow this path:

```text
scan -> canvas -> owner file -> small patch -> guard -> typecheck -> build -> auto report
```

## Implemented in this slice

- Debug panel is no longer enabled by default. It requires a URL flag or env flag.
- Feature ownership contracts remain the source of truth for Account Rail, Notifications, Output Activity, Console Shell, and Client Workspace.
- Performance guard validates the most important anti-lag rules.

## Debug panel flags

```text
?debugPanel=1
?xdisputerDebug=panel
?xdisputerDebug=1
?debug=ui
?debug=ui-panel
```

or:

```text
NEXT_PUBLIC_XDISPUTER_DEBUG_PANEL=1
```

## Verification

```bash
node scripts/performance-boost-guard.mjs
node scripts/repo-precision-audit.mjs
npm run ui-source:guard
npm run typecheck
npm run build
```
