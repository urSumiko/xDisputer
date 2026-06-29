# UI Collapse Recovery

## Problem

Recent screenshots showed several layout collapses:

- Evidence Files panel became a narrow floating rail instead of the left column.
- Supporting Documents header action clipped the Generate button text.
- Master/manager console sidebars compressed brand text and mode-switch cards.
- Master account directory showed filter controls and dataset rows as separate competing surfaces.
- Directory back action became a large duplicate blue tab instead of a small command.

## Root cause

The main issue was CSS-layer collision. The root layout imports many focused CSS layers. `evidence-files-restored-layout.css` defines the intended three-column evidence editor contract:

```text
Evidence files | Preview page | Selected image controls
```

But `supporting-editor-balanced-stage.css` is imported later and overrides `.support-layout-grid.word-crop-grid` into a two-column layout. Because `SupportingDocumentsLayoutEditor` still renders `.word-left-evidence-manager`, the Evidence Files panel is pushed into an implicit grid area and collapses.

The same class of problem affected command headers, sidebars, and directory datasets: older broad selectors were overriding newer responsive intent.

## Fix

A final recovery layer was added and imported last:

```text
app/ui-collapse-recovery.css
```

This layer restores final layout contracts without changing business logic.

## Protected contracts

### Supporting Documents

- Desktop uses three columns: Evidence files, page preview, controls.
- Medium widths stack Evidence below Preview/Controls instead of shrinking it.
- Mobile stacks Preview, Controls, then Evidence.
- Evidence cards keep file names/actions contained.

### Source Data header

- Back and Generate actions wrap cleanly.
- Generate text is not clipped.
- Generate remains disabled until deterministic `packetReady` is true.

### Sidebars

- Client, manager, and master brands use `auto + minmax(0, 1fr)` layout.
- Brand title/subtitle truncate instead of overlapping.
- Console mode-switch cards wrap safely.

### Master account directory

- Dataset filter controls live inside one dataset card.
- Directory action is a compact pill, not a large duplicate tab.
- Pager and table controls wrap safely.

## Guard

Run:

```bash
node scripts/ui-collapse-contract-guard.mjs
```

The guard verifies:

- `ui-collapse-recovery.css` exists and imports last.
- Evidence grid keeps the `evidence preview controls` contract.
- Evidence manager slot remains in the layout editor.
- Generate button remains controlled by deterministic `packetReady`.
- Master directory keeps the single-header dataset wrapper.

## Validation

Run from Codespaces:

```bash
node scripts/ui-collapse-contract-guard.mjs
node scripts/ai-ui-contract-guard.mjs
node scripts/ai-backend-contract-guard.mjs
npm run typecheck
npm run build
```
