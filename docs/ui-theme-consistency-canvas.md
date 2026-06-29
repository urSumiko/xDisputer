# xDisputer UI Theme Consistency Canvas

## Purpose

xDisputer has client, manager, master, auth, template, source, evidence, and output surfaces. Many focused CSS layers can make buttons, cards, headers, shadows, and spacing feel inconsistent. This canvas adds one visual theme contract that normalizes the design language without changing app behavior.

## Core rule

```text
Theme owns visual language.
Layout contracts own geometry.
Business components own behavior.
```

## Implemented files

```text
app/ui-theme-contracts.css
scripts/theme-consistency-guard.mjs
docs/ui-theme-consistency-canvas.md
app/layout.tsx
```

## CSS order

```ts
import './ui-collapse-recovery.css';
import './ui-theme-contracts.css';
import './ui-layout-contracts.css';
```

The order is intentional:

1. Older route CSS loads first.
2. Collapse recovery catches known layout fixes.
3. Theme contracts own visual consistency.
4. Layout contracts own final geometry.

## Theme ownership

The theme owns:

- background and surface colors
- text and muted text colors
- line and border color
- primary, success, warning, and danger states
- radius scale
- shadow scale
- safe transition timing
- skeleton loading feedback
- form control appearance
- primary and secondary button appearance
- focus-visible state
- reduced-motion fallback

## Function-specific UX direction

### Client workspace

Simple guided workflow with clear cards, active sidebar state, strong primary actions, and quiet secondary controls.

### Source Data and Evidence

Operational clarity. Required steps remain visible, warnings are clear, Generate stays controlled by deterministic readiness, and the evidence editor follows the layout contract.

### Templates

Template control stays safe. Manager-controlled labels remain visible, status cards share the same surface style, and assistant panels use the same card language.

### Master and Manager console

Dashboard authority without visual chaos. Dataset filters, tables, and pagers feel like one connected surface.

### Auth pages

Minimal login flow using the same card, input, and error styles without requiring workspace shell elements.

## Performance rules

The theme avoids heavy effects. It does not use broad transition-all behavior, expensive blur layers, or JavaScript animation. It transitions only paint-friendly state properties.

## Guard

Run:

```bash
node scripts/theme-consistency-guard.mjs
```

The guard checks that the theme is imported, the body has the theme contract, required visual tokens exist, reduced-motion safety exists, and expensive visual patterns are not introduced.

## Full validation

```bash
node scripts/theme-consistency-guard.mjs
node scripts/ui-layout-contract-guard.mjs
node scripts/ui-collapse-contract-guard.mjs
node scripts/ai-ui-contract-guard.mjs
node scripts/ai-backend-contract-guard.mjs
npm run responsive:guard
npm run typecheck
npm run build
```

## Not changed

```text
No database schema changes.
No auth logic changes.
No generation logic changes.
No template mutation logic changes.
No route behavior changes.
```

This is a visual consistency layer only.
