# Master UI/UX Switch Mode Workspace Canvas

## Title

**xDisputer Master Hologram Workspace 2.0 — MS Word for UI/UX, Not Just Drag Cards**

## Purpose

Create a master-only visual governance workspace that behaves like Microsoft Word for the website UI. Master users can preview the product as client, manager, or master, switch between control modes, drag approved UI blocks with dnd-kit, edit block properties live, inspect role-scoped navigation, tune approved theme tokens, and prepare guarded AI patch proposals.

This implementation is intentionally guarded: it upgrades the workspace from native drag/drop into a dnd-kit editor, but publishing to all users is still held for the backend persistence, RLS, audit, publish, and rollback phase.

## Existing logic merged

This workspace sits on top of existing xDisputer UI governance layers:

```text
app/ui-theme-contracts.css              = base product tokens
app/ui-theme-triad.css                  = Client/Auth Aurora, Manager Graphite, Master Executive
app/unified-surface-contracts.css       = shared sidebar/header/card/chip/table behavior
app/master-hologram-workspace.css       = master-only visual control workspace
app/instant-interaction-performance.css = fast hover/tap/loading feedback
app/ui-layout-contracts.css             = final geometry owner
```

Existing security is preserved through:

```text
requireRole('master') on app/master/ui-workspace/page.tsx
no arbitrary HTML injection
no browser service role key
no publish mutation in this phase
no dangerouslySetInnerHTML
no eval
```

## 5W + HOW

### Who

- Master users can open and use the workspace.
- Client and manager users do not get editor controls.
- AI can propose future patches only through the proposal gate.

### What

The workspace now provides:

- Live View
- Edit Canvas with dnd-kit sorting
- Navigation Builder with local add/edit/enable drafts
- Theme Studio with editable approved token values
- Content Studio through the inspector fields
- Behavior Studio through interaction/data/mobile controls
- AI Proposal Gate with structured JSON preview
- Publish Center readiness view
- Role preview switch: client, manager, master
- Viewport preview switch: desktop, tablet, mobile
- Inspector panel for selected block properties and behaviours

### When

Use this route when planning or previewing cross-role UI/UX changes before coding or publishing them.

### Where

```text
/master/ui-workspace
```

Implementation files:

```text
app/master/ui-workspace/page.tsx
app/master/ui-workspace/loading.tsx
components/master-ui-workspace/MasterHologramWorkspaceShell.tsx
components/master-ui-workspace/SortableHologramBlock.tsx
lib/master-ui-workspace/model.ts
app/master-hologram-workspace.css
scripts/master-ui-workspace-guard.mjs
docs/master-ui-ux-switch-mode-workspace-canvas.md
```

### Why

A master workspace should control xDisputer UI/UX through structured, versioned, role-aware models rather than raw code injection. The workspace should feel like a hologram control layer over the website: it shows the shape of the product, what can move, what is locked, what properties can change, and what must pass guards before publishing.

### How

```text
master opens /master/ui-workspace
→ server runs requireRole('master')
→ ConsoleShell renders master governance surface
→ MasterHologramWorkspaceShell loads client-side local draft state
→ dnd-kit sensors initialize pointer + keyboard drag
→ master switches mode / role / viewport
→ master drags unlocked blocks in Edit Canvas mode
→ DragOverlay previews the moving UI block
→ inspector edits block props and behaviour live
→ Navigation Builder creates local nav drafts
→ Theme Studio edits allowlisted tokens locally
→ AI Proposal Gate renders structured patch preview
→ future backend phase persists draft/publish/rollback/audit records
```

## dnd-kit architecture

```text
DndContext
→ PointerSensor with activation distance
→ KeyboardSensor with sortableKeyboardCoordinates
→ closestCenter collision detection
→ restrictToVerticalAxis + restrictToParentElement modifiers
→ SortableContext with visible block ids in render order
→ useSortable per block
→ DragOverlay for smooth hologram preview
```

Rules:

```text
SortableContext items must match rendered order.
Locked blocks cannot be dragged.
Drag updates local draft state only.
No Supabase writes happen during drag.
No full page reload after movement.
No layout-heavy animation during drag.
```

## Switch modes

### Live View

Read-only preview of the current role-scoped UI model.

### Edit Canvas

Drag/reorder approved blocks with dnd-kit. Locked system blocks cannot be dragged.

### Navigation Builder

Inspect, add, edit, enable, and disable local role-scoped navigation drafts.

### Theme Studio

Edit approved token controls for triad themes and global surface behavior.

### Content Studio

Edit presentation copy through the inspector: eyebrow, title, description, density, alignment, and columns.

### Behavior Studio

Edit safe UI behavior: interaction type, data source, mobile visibility, and future resize readiness.

### AI Proposal Gate

Turn a natural-language UI command into a structured JSON proposal preview. AI cannot publish.

### Publish Center

Show risk score, required guards, and publish readiness. Backend publish comes later.

## Five customization features

1. **Visual Layout Builder** — move approved route blocks and sections using dnd-kit.
2. **Navigation Builder** — add/edit/enable/disable role-scoped nav drafts.
3. **Theme Studio** — tune token-based colors, radius, chips, sidebar width, and motion.
4. **Content + Context Editor** — edit titles, descriptions, empty states, labels, and helper copy.
5. **AI Proposal Gate** — generate structured patch previews with risk score and guard metadata.

## What loads first

- ConsoleShell
- Master UI workspace shell
- Mode strip
- Role preview switch
- Viewport switch
- Local block model
- Inspector panel
- dnd-kit client bundle for the master-only route

## What loads later in future backend phase

- Published runtime UI version
- Draft route tree
- Navigation records
- Theme overrides
- Content overrides
- Publish events
- Audit logs
- AI proposal history

## What is cached

- Static CSS
- Static JS chunks
- Approved model metadata
- Role preview state in memory
- Local draft state until backend persistence is wired

## What is paginated in future backend phase

- Audit logs
- Change requests
- Version history
- AI proposals

## What should not happen

```text
Do not let master inject raw unsafe JavaScript.
Do not use dangerouslySetInnerHTML.
Do not use eval.
Do not let AI publish directly.
Do not expose service role keys in frontend.
Do not bypass RLS.
Do not persist drafts without audit logs.
Do not let a broken draft affect live users.
Do not reload the full page after every drag.
Do not animate layout-heavy properties during drag.
Do not write to Supabase on every hover or drag frame.
Do not remove existing theme, triad, surface, instant, or layout contracts.
```

## Backend phase still required

The current coded phase is a dnd-kit visual-control shell. Full production publishing still needs:

```text
Supabase tables
RLS policies
draft save endpoint
preview endpoint
publish endpoint
rollback endpoint
audit logs
runtime UI fetcher
component registry validation
AI structured-output validation
```

## Definition of done for this phase

- `/master/ui-workspace` is master-only.
- The route renders inside the existing ConsoleShell.
- The route has an instant loading state.
- The shell has eight switch modes.
- The shell previews client, manager, and master role surfaces.
- The shell previews desktop, tablet, and mobile frames.
- Unlocked blocks can be locally reordered with dnd-kit.
- Locked blocks stay protected.
- Inspector edits selected block props and behaviour live.
- Navigation Builder creates local nav drafts.
- Theme Studio edits allowlisted token values locally.
- AI Proposal Gate shows structured patch preview.
- Guards validate the route, model, dnd-kit dependencies, styling, and safety constraints.
