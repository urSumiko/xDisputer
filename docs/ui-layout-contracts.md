# xDisputer UI Layout Contracts

## Goal

This document defines the permanent layout ownership model for the surfaces that previously collapsed or overflowed:

- Supporting Documents evidence editor
- Step command headers, especially the Generate header
- Master account directory datasets
- Client / manager / master sidebars

The rule is simple: **one visual surface has one layout owner**.

## Why this exists

The app has many focused CSS files. Several files target the same layout classes. That caused the browser cascade to decide layout ownership based on import order instead of component intent.

The final contract layer fixes that by declaring explicit geometry for critical surfaces and importing it last:

```ts
import './ui-collapse-recovery.css';
import './ui-layout-contracts.css';
```

## Contract 1: Supporting Documents editor

Desktop order:

```text
Evidence files | Page preview | Selected image controls
```

Tablet order:

```text
Page preview | Selected image controls
Evidence files
```

Mobile order:

```text
Page preview
Selected image controls
Evidence files
```

Owned by:

```css
[data-layout-contract="supporting-documents-editor"],
.support-layout-grid.word-crop-grid
```

Zone mapping:

```css
.word-left-evidence-manager  -> evidence
.support-page-frame          -> preview
.word-crop-controls          -> controls
```

## Contract 2: Command headers

Command headers use a copy/actions split. Actions wrap instead of clipping.

Owned by:

```css
[data-layout-contract="command-header"],
.source-progressive-command,
.template-stage-command,
.template-selected-command,
.supporting-header
```

Rules:

- Copy gets `minmax(0, 1fr)`.
- Actions wrap.
- Buttons can wrap text.
- Buttons never push outside the card.

## Contract 3: Master account dataset

Directory pages must treat filters, rows, and pager as one dataset surface.

Owned by:

```css
[data-layout-contract="dataset-card"],
.single-header-dataset .admin-monitor-card,
.native-operation-card
```

Rules:

- Filter toolbar stays inside the dataset card.
- Rows stay inside the card.
- Pager stays inside the card.
- The `Account directory` action is a compact pill, not a duplicate blue tab.

## Contract 4: Sidebar stability

Owned by:

```css
[data-layout-contract="console-sidebar"],
.admin-monitor-sidebar.native-console-sidebar,
.app-shell > .sidebar
```

Rules:

- Brand text truncates instead of overlapping.
- Sidebar nav remains readable.
- Mode switch wraps safely.
- Main content cannot slide under or outside the sidebar.

## Guard

Run:

```bash
node scripts/ui-layout-contract-guard.mjs
```

The guard verifies:

- `ui-layout-contracts.css` imports last.
- Evidence/Preview/Controls grid contract exists.
- Tablet and mobile order exists.
- Generate remains deterministic through `packetReady`.
- Master account directory declares dataset zones.
- Console sidebar declares its layout contract.
- Fixed desktop widths are not introduced.

## Validation

Run:

```bash
node scripts/ui-layout-contract-guard.mjs
node scripts/ui-collapse-contract-guard.mjs
node scripts/ai-ui-contract-guard.mjs
node scripts/ai-backend-contract-guard.mjs
npm run responsive:guard
npm run typecheck
npm run build
```
