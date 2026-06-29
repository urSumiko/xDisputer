# xDisputer Frontend Command Architecture Canvas

Last updated: 2026-06-17

## Purpose

This canvas defines the frontend control layer for xDisputer. It is an additive architecture foundation for transforming the current website into a registry-driven interface where shared UI identity, shared actions, shared content, shared layouts, and performance profiles are defined once and reused across public, client, manager, and master experiences.

## Core execution rule

Server-first structure. Client-only interaction. Global identity before local styling. Registry before one-off behavior.

## Implemented foundation

| Layer | File | Purpose |
| --- | --- | --- |
| Account scope | `lib/frontend-control/account-scope.ts` | Defines public, client, manager, and master scope inheritance. |
| Action registry | `lib/frontend-control/action-registry.ts` | Defines shared frontend action contracts such as feedback, pending state, search, refresh, upload, validation, navigation, and read state. |
| Content registry | `lib/frontend-control/content-registry.ts` | Defines shared UI copy and action labels. |
| Identity registry | `lib/frontend-control/identity-registry.ts` | Maps reusable component identities to variants, actions, and token groups. |
| Layout registry | `lib/frontend-control/layout-registry.ts` | Defines reusable layout contracts and default component identities. |
| Navigation map | `lib/frontend-control/navigation-map.ts` | Defines top-level navigation identity and loading mode. |
| Performance profile | `lib/frontend-control/performance-profile.ts` | Defines server-first, streamed, private, live, and fresh operation rendering profiles. |
| Resolver | `lib/frontend-control/resolve-control.ts` | Reads registry entries together so future components can consume a single control snapshot. |
| Design tokens | `lib/design-system/tokens.ts` | Defines spacing, radius, motion, elevation, and density primitives. |
| Variants | `lib/design-system/variants.ts` | Defines shared intent, size, and surface variants. |
| Guard | `scripts/frontend-control-guard.mjs` | Validates that the foundation files and required package script exist. |

## Required coding model

1. A repeated visual element must use a `ComponentIdentity`.
2. A repeated action must use an `ActionId` from the action registry.
3. A repeated label or message must use a `ContentKey`.
4. A repeated shell or workspace shape must use a `LayoutId`.
5. A route or navigation item must use the navigation map.
6. A slow or data-heavy UI area must declare a performance profile.
7. Local state stays local unless another route or workspace needs it.
8. New UI work must pass `npm run frontend-control:guard`.

## Target architecture

```text
components/
  primitives/
  patterns/
  shell/
  workspaces/

lib/
  frontend-control/
  design-system/
  data/
  observability/
```

## Migration phases

### Phase 1: Foundation

Add registries, resolver, guard, and documentation. This phase is now implemented.

### Phase 2: Shell adoption

Refactor shell components to resolve layout, navigation, and global content from the frontend control layer.

Priority targets:

- `app/layout.tsx`
- console shell components
- manager shell components
- master workspace home
- notification entry points

### Phase 3: Reusable component adoption

Convert repeated primitives and patterns to identity-driven components.

Priority identities:

- `action.primary`
- `action.secondary`
- `table.directory`
- `panel.template`
- `panel.audit`
- `metric.card`
- `notification.item`
- `workspace.frame`

### Phase 4: Performance pass

Convert data-heavy views into server-first containers with small client islands only for browser interaction.

Required profile choices:

- `staticGlobal` for registry/config content
- `sessionPrivate` for signed-in account summary data
- `workspaceLive` for workspace panels with live refresh
- `noStore` for generation and document operation state

### Phase 5: Enforcement

Extend the guard to verify that new shared UI imports from the registry layer instead of creating direct duplicates.

## Expected final behavior

Changing one shared identity, action, content key, layout, or performance profile updates every matching UI area consistently across master, manager, and client accounts.
