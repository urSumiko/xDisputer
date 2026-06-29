# UI Shell Roadmap Tracker

Active mode: GitHub repo + Codespaces + Supabase. Deployment remains disabled by default unless an approved MCoder deployment request is consumed by the approved workflow.

## Current objective

Keep every console surface on the same header-shell model and stop source/UI drift:

- normal dev/typecheck/build commands must verify source, not rewrite tracked UI files
- `ConsoleShell` is the single shell/sidebar/main owner
- `ConsoleHeader` is the single reusable route-level header contract
- `AccountMenu` is the single role-aware avatar/account dock owner
- `RenderDebugger` exposes the actual rendered shell, header, account menu, CSS list, and ratio at runtime
- `deployment_requests` and the MCoder gate must approve a deployment before the deploy workflow can run
- route smoke checks must prove the rendered UI contains the shell markers and can capture screenshots
- old sidebar account footer and sign-out duplicates are removed
- compact template summary chips remain removed

## Stabilization roadmap

| Phase | Status | Source of truth | Guard |
| --- | --- | --- | --- |
| Phase A — Disable auto-rewrite UI scripts | Implemented | `package.json` + `scripts/phase14-local-safety-check.mjs` | `scripts/no-autowrite-ui-guard.mjs` |
| Phase B — Single ConsoleShell ownership | Implemented | `components/console/ConsoleShell.tsx` | `scripts/console-shell-contract-guard.mjs` |
| Phase C — Single ConsoleHeader | Implemented | `components/console/ConsoleHeader.tsx` | `scripts/console-shell-contract-guard.mjs` |
| Phase D — Single AccountMenu | Implemented | `components/console/AccountMenu.tsx` | `scripts/console-shell-contract-guard.mjs` |
| Phase E — Render debugger overlay | Implemented | `components/console/RenderDebugger.tsx` | `scripts/console-shell-contract-guard.mjs` |
| Phase F — M-coder deployment gate | Implemented | `supabase/migrations/20260615080000_mcoder_deployment_gate.sql` + `scripts/mcoder-deployment-gate.mjs` + `.github/workflows/deploy-approved.yml` | `scripts/console-shell-contract-guard.mjs` |
| Phase G — Route screenshot smoke audit | Implemented | `playwright.config.ts` + `tests/ui-shell-smoke.spec.ts` | `npm run ui-shell:smoke` |

## Legacy shell roadmap

| Phase | Status | Source of truth | Guard |
| --- | --- | --- | --- |
| Phase 0 — Shell surface inventory | Implemented | This tracker | `scripts/ui-shell-registry-guard.mjs` |
| Phase 1 — Global shell contract | Implemented | `components/console/ConsoleShell.tsx` | `scripts/console-shell-contract-guard.mjs` |
| Phase 2 — Global layout tokens | Implemented | `app/console-shell-system.css` | `scripts/console-shell-contract-guard.mjs` |
| Phase 3 — Shared avatar account dock | Implemented | `components/console/AccountMenu.tsx` + `app/account-menu-ratio-system.css` | `scripts/manager-visible-switch-contract-guard.mjs` |
| Phase 4 — Remaining master secondary pages | Implemented | `/master/reports`, `/master/audit`, `/master/system`, `/master/recovery` | `scripts/console-shell-contract-guard.mjs` |
| Phase 5 — Remaining manager secondary pages | Implemented | `/admin/access`, `/admin/clients`, `/admin/reports`, `/admin/audit` | `scripts/console-shell-contract-guard.mjs` |

## Implemented surfaces

| Surface | Status | Shell source | Avatar menu | Debuggable |
| --- | --- | --- | --- | --- |
| Manager operations `/admin` | Implemented | `components/ManagerConsoleShell.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Manager workspace `/manager-workspace` | Implemented | `components/ManagerConsoleShell.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Manager access `/admin/access` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Manager clients `/admin/clients` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Manager reports `/admin/reports` | Implemented | `components/GenerationReportView.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Manager audit `/admin/audit` | Implemented | `components/AccessAuditView.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master home `/master` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master accounts `/master/accounts` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master workspaces `/master/workspaces` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master reports `/master/reports` | Implemented | `components/GenerationReportView.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master audit `/master/audit` | Implemented | `components/AccessAuditView.tsx` → `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master system `/master/system` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |
| Master recovery `/master/recovery` | Implemented | `components/console/ConsoleShell.tsx` | Implemented | Yes |

## Guarded contract

The active guards are:

```bash
node scripts/phase14-local-safety-check.mjs
npm run ui-source:guard
```

They check:

- dev/typecheck/build no longer run legacy UI auto-rewrite scripts
- the UI registry lists every shell route owner
- `ConsoleShell` owns sidebar/main/header grid placement
- `ConsoleShell` owns `ConsoleHeader` placement
- `ConsoleShell` owns the shared role-aware `AccountMenu`
- `ManagerAccountMenu` remains only as a compatibility wrapper
- `RenderDebugger` is mounted from `app/layout.tsx`
- `window.__xdisputerDebug` is populated in local/dev runtime
- account menu is inside the header-flow grid
- final ratio override stylesheet is imported through the active account menu CSS chain
- template summary chips are removed
- old sidebar account footer is removed
- MCoder deployment gate files exist and are wired
- route smoke audit files exist and are wired

## Verification command

```bash
npm run xdisputer:guard
```

## MCoder approval flow

Create a request:

```bash
npm run mcoder:request -- --group ui-shell --sha "$(git rev-parse HEAD)" --ref "$(git rev-parse --abbrev-ref HEAD)" --environment production --requested-by "developer@example.com" --summary '{"change":"ui shell stabilization"}'
```

Approve it:

```bash
npm run mcoder:approve -- --request-id "<deployment_request_id>" --reviewed-by "mcoder@example.com" --comment "Approved after guard and smoke audit"
```

Then manually run the GitHub workflow `Deploy approved build` with the request id and environment.

## Manual runtime test

```bash
npm run codespace:dev
```

Open any shell route with the debugger enabled:

```text
/admin?xdisputerDebug=1
/manager-workspace?xdisputerDebug=1
/master?xdisputerDebug=1
```

Then check DevTools:

```js
window.__xdisputerDebug
```

## Screenshot smoke audit

Create a Playwright authenticated storage-state file and point `E2E_AUTH_STATE` to it, then run:

```bash
npm run ui-shell:smoke
```
