# Unified Native Surface Canvas

## Title

**xDisputer Unified Native Surface Canvas — One Layout Behavior, One Native Surface, Zero Overflow Drift**

## Main problem

The website already has a global theme contract, shared surface contracts, layout contracts, and instant interaction rules. The remaining problem was that old role-theme forks and legacy shell layers still existed beside the native console system.

The fix is one native surface-contract workspace that sits between theme tokens and final geometry:

```text
ui-theme-contracts.css              = base tokens
unified-surface-contracts.css       = shared surface behavior across all users
native-client-console.css           = client shell alignment to native console
instant-interaction-performance.css = fast hover/tap/loading feedback
ui-layout-contracts.css             = final geometry owner
```

## Strong analogy

xDisputer is one production office, not three separate decorated offices.

Client, manager, and master users can have different functions, but every desk, drawer, label, border, card, sidebar, and navigation path must follow one office standard.

## Existing logic merged

This canvas merges and improves existing logic:

- `app/ui-theme-contracts.css` for shared color, type, radius, buttons, inputs, skeletons, and status tones.
- `app/unified-surface-contracts.css` for one native surface behavior.
- `app/native-client-console.css` for client alignment with the same native shell language.
- `app/instant-interaction-performance.css` for fast float and loading feedback.
- `app/ui-layout-contracts.css` for final grid/flex/sidebar/header geometry.
- `components/console/ConsoleShell.tsx` for manager/master role-aware shell metadata.
- `components/ConsoleNavLink.tsx` for prefetch and optimistic navigation feedback.

## 5W + HOW

### Who

- Client users
- Manager users
- Master users
- Auth users

### What

The unified surface contract owns shared behavior for:

- side navigation behavior
- header orientation
- context labels
- cards and panels
- chips, badges, status labels
- filters, pagers, and data tables
- border rules and border overlap prevention
- compact mobile behavior
- no horizontal overflow

### When

Use the unified native surface contract when a visual issue appears across more than one role or feature.

### Where

```text
app/unified-surface-contracts.css
app/native-client-console.css
scripts/theme-governance-contract-guard.mjs
docs/unified-triad-surface-canvas.md
```

### Why

A SaaS product feels professional when users can move between client, manager, master, auth, source, template, and report surfaces without relearning layout behavior.

### How

```text
request comes in
→ classify the issue
→ if color/token/action/input: use ui-theme-contracts.css
→ else if shared sidebars/headers/cards/chips/borders/tables: use unified-surface-contracts.css
→ else if client shell must align to native console: use native-client-console.css
→ else if hover/tap/sluggishness/loading feedback: use instant-interaction-performance.css
→ else if grid/flex/responsive order/overflow geometry: use ui-layout-contracts.css
→ else if data/auth/RLS/API: inspect backend/Supabase, not CSS
```

## Global vs customized organization

### Global

Global behavior belongs to `app/unified-surface-contracts.css` only when it applies to all or most users.

Examples:

- sidebar row height
- active navigation shape
- card radius
- header copy/action orientation
- chip compactness
- filter card behavior
- table overflow containment

### Customized

Role function stays in component logic, not global theme forks.

Local visual emphasis belongs in the existing unified theme hooks, not in a separate client/manager/master theme layer.

## What loads first

- root layout
- global theme tokens
- unified surface behavior
- client shell alignment layer
- instant interaction rules
- final layout contracts

## What loads later

- Supabase protected role/session data
- account datasets
- reports
- audit events
- generated outputs

## What is cached

- CSS layers
- static JS chunks
- route loading shells
- deterministic shell markup

## What is paginated

- manager client datasets
- master account datasets
- workspace directories
- reports
- audit/event streams

## What is refreshed

- route datasets after mutations
- auth/session after login/logout
- generation results after successful packet creation
- account control state after approve/reject/disable/reactivate

## What fallback appears

- route loading shells
- skeleton cards
- disabled action state
- empty dataset card
- error alert surface

## What should not happen

```text
Do not create a new global theme for a single route.
Do not reintroduce triad role themes.
Do not import obsidian or compact shell CSS into root bundles.
Do not put backend/auth/RLS fixes in CSS.
Do not override final geometry in theme files.
Do not animate width, height, margin, padding, top, or left.
Do not use transition-property: all.
Do not add blur or heavy backdrop effects for core cards.
Do not allow horizontal overflow to hide real layout bugs.
Do not make manager/master/client navigation behave differently unless the function requires it.
Do not hardcode one-off borders, radii, or chips when the surface contract covers them.
```

## Definition of done

- All major surfaces use one sidebar behavior pattern.
- Headers use one copy/action orientation.
- Cards and panels use one border/radius/overflow rule.
- Chips and badges are compact and consistent.
- Data filters and pagers feel like one surface.
- Tables scroll horizontally inside their own wrapper, not the whole page.
- Client aligns with manager/master native console language.
- Old triad/obsidian/compact layers stay retired.
- Guards, typecheck, and build pass.
