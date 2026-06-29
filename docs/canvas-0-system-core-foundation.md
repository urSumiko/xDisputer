# Canvas 0 — System Core Foundation

Canvas 0 is the critical base layer for the ranked workspace implementation. It creates the non-UI kernel that later Master, Manager, and Client surfaces must depend on.

## Engineering Order

1. Types and contracts
2. RBAC permission matrix
3. Workspace context resolver
4. System event bus
5. Design token registry
6. Component identity registry
7. Global core orchestrator
8. Guard script

## Implemented Modules

| Module | Purpose |
| --- | --- |
| `lib/system-core/types.ts` | Shared roles, workspace kinds, permissions, events, tokens, and component identity contracts. |
| `lib/system-core/rbac.ts` | Master / Manager / Client permission matrix and workspace access decisions. |
| `lib/system-core/workspace.ts` | Workspace context creation, selection mode boundaries, and workspace titles. |
| `lib/system-core/event-bus.ts` | Typed publish / subscribe event bus for global UI state propagation. |
| `lib/system-core/design-tokens.ts` | Global, workspace, role, and component token registry. |
| `lib/system-core/component-registry.ts` | DevTools-style component identity and propagation group registry. |
| `lib/system-core/global-core.ts` | Orchestrates workspace context, RBAC, design tokens, component registry, and propagation events. |
| `scripts/system-core-guard.mjs` | Verifies that Canvas 0 files and required markers exist. |

## Permission Logic

Master owns full global authority.

Manager owns operational authority for its own clients:

- client access control
- client monitoring
- client reports
- generation output snapshots
- generation packet testing

Client owns consumption-only access:

- client workspace
- notifications
- generated outputs
- limited reports

## Workspace Boundary Model

```txt
master  -> master workspace + selection mode for manager/client subjects
manager -> manager workspace + owned-client controls
client  -> client workspace only
```

## Expected Behavior

After Canvas 0:

- UI features can check permissions through one RBAC system.
- Master selection mode is explicitly modeled.
- Manager/client boundaries are no longer implied by route naming.
- Design tokens and component identities have registries before UI implementation begins.
- Global rule propagation can target components by `propagationGroup`.

## Guard

Run:

```bash
npm run system-core:guard
```

Expected output:

```txt
Canvas 0 System Core Guard passed.
```
