# Native UI Unification Canvas

## Goal

Use one native xDisputer product language across client, manager, and master surfaces.

This canvas retires the old three-theme split and keeps one lightweight interface model:

- one base theme contract
- one shared surface behavior layer
- one instant interaction layer
- one final layout layer
- one client-alignment layer for workspace sync

## Root cause being fixed

The repo had multiple visual systems active at the same time:

- triad role themes
- obsidian shell theme
- compact shell theme
- native console shell

That caused contradictory styling ownership, higher global CSS cost, and unnecessary visual drift between client, manager, and master pages.

## Source of truth

- `app/root-css-contracts.css`
- `app/root-css-console-shell.css`
- `app/root-css-client-portal.css`
- `app/ui-theme-contracts.css`
- `app/unified-surface-contracts.css`
- `app/native-client-console.css`
- `app/instant-interaction-performance.css`
- `app/ui-layout-contracts.css`
- `components/console/ConsoleShell.tsx`
- `components/LetterGeneratorWorkspaceV2.tsx`

## Traceability

### Client

- workspace shell and sidebar behavior
- account rail and header alignment
- shared surface radius, border, and spacing rules

### Manager

- console sidebar and header behavior
- workflow cards and tables
- lightweight account rail and notification ownership

### Master

- same native console behavior as manager
- no separate executive theme fork
- same navigation, header, panel, and table behavior

## What changes belong where

### Theme tokens

Use `app/ui-theme-contracts.css` for:

- color tokens
- buttons
- inputs
- status tones
- loading hooks
- safe motion tokens

### Shared surface behavior

Use `app/unified-surface-contracts.css` for:

- sidebars
- headers
- panels
- chips and badges
- filters
- tables
- overflow rules

### Client alignment only

Use `app/native-client-console.css` only when client workspace needs to stay visually aligned with the manager/master native console.

### Performance

Use `app/instant-interaction-performance.css` for:

- sluggish hover/tap feedback
- dense console motion reduction
- safe interaction timing

### Final geometry

Use `app/ui-layout-contracts.css` for:

- grid
- flex
- spacing ownership
- responsive order
- overflow containment

## What is retired

- triad role-theme layer
- obsidian shell layer
- compact shell layer
- AI assistant review panels
- dead assistant wiring docs and guards

## What not to do

- Do not create a role-specific global theme again.
- Do not reintroduce obsidian or compact shell CSS into the root bundles.
- Do not create different manager/master/client sidebar behavior unless function requires it.
- Do not solve backend problems with CSS.
- Do not add duplicate review assistant panels when deterministic flows already exist.

## Definition of done

- manager and master use one native console surface
- client shell aligns visually with the same native console language
- old triad/obsidian/compact layers are removed from root bundles
- dead AI assistant UI files are retired
- guards, typecheck, and build pass
