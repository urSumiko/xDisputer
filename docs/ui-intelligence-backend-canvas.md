# xDisputer UI Intelligence Backend Canvas

## Status

Implemented as a backend governance layer under `lib/ui-intelligence/` with guard, report, map, internal API endpoints, and source verification wiring.

## Purpose

The UI Intelligence Engine prevents UI drift by making every global layout, account menu, switch mode, template execution surface, and runtime debugger behavior explicit, inspectable, traceable, and guarded.

## 5W + How filter

- **Who** owns the UI or process: manager, master, client, system, or global.
- **What** contract is affected: layout, component, account, navigation, template, process, API, database, style, or runtime debug.
- **Where** the responsible source files and routes live.
- **When** a change is global, domain-level, route-only, component-level, or custom.
- **Why** the change exists and what failure it prevents.
- **How** the change propagates through affected contracts, routes, guards, and runtime debugger proof.

## Implemented source map

```txt
lib/ui-intelligence/types.ts
lib/ui-intelligence/registry.ts
lib/ui-intelligence/classifiers/global-custom-classifier.ts
lib/ui-intelligence/inspectors/design-inspector.ts
lib/ui-intelligence/inspectors/layout-inspector.ts
lib/ui-intelligence/inspectors/ux-inspector.ts
lib/ui-intelligence/inspectors/function-inspector.ts
lib/ui-intelligence/trace/root-cause-tracer.ts
lib/ui-intelligence/trace/dependency-graph.ts
lib/ui-intelligence/propagation/change-propagation-engine.ts
lib/ui-intelligence/reports/ui-intelligence-report.ts
lib/ui-intelligence/index.ts
scripts/ui-intelligence-guard.mjs
scripts/ui-intelligence-report.mjs
scripts/ui-intelligence-map.mjs
app/api/internal/ui-intelligence/report/route.ts
app/api/internal/ui-intelligence/trace/route.ts
app/api/internal/ui-intelligence/propagation-plan/route.ts
```

## Registered contracts

- `console-shell`: canonical global shell for manager, master, and workspace pages.
- `console-header`: canonical header card and 75/25 rail pairing.
- `account-menu`: active-account settings, display name save, and session security.
- `sidebar-switch-mode`: highlighted bottom-left mode switch.
- `render-debugger`: runtime proof for shell, grid, ratio, CSS, and detection mode.
- `template-execution`: manager dynamic template pipeline contract.

## Guard commands

```bash
npm run ui-intelligence:guard
npm run ui-intelligence:report
npm run ui-intelligence:map
npm run ui-source:guard
npm run repo:guard
```

## Change workflow

1. Register the UI/process/function contract.
2. Classify the change as global, domain, route, component, or custom.
3. Generate affected contracts and routes.
4. Apply the source change.
5. Update guard coverage.
6. Run UI intelligence and console shell guards.
7. Run typecheck/build.
8. Verify runtime proof with the xDisputer debugger.

## Hard rules

- No route-owned console shell when `ConsoleShell` is the global contract.
- No duplicate sidebar account footer.
- No switch mode inside account settings.
- No account popover shortcut lists.
- No global CSS override without a propagation group.
- No template field outside canonical mapping/registry logic.
- No future UI change should bypass `UIIntelligenceEngine`.
