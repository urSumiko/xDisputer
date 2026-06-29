# xDisputer Website Stability + Performance Cleanup Canvas

## Purpose

Make every xDisputer page stable, smooth, and predictable. The immediate target is to remove UI flicker/glitch behavior where controls briefly appear/disappear, stale data shows before the correct data, or layout jumps after hydration.

This canvas is the implementation contract for a repo-wide cleanup. It favors small, explicit fixes over broad rewrites.

---

## Non-negotiable outcome

The website must feel like one stable application:

1. No random disappearing controls.
2. No duplicate fetch loops for the same page state.
3. No layout jump when data loads.
4. No client/server mismatch flicker.
5. No stale notification/output activity state.
6. No hidden source of truth conflict between UI state, Supabase rows, and browser local state.
7. Each page must have a clear loading, empty, ready, error, and saving state.

---

## Current symptoms to eliminate

| Symptom | Likely cause | Fix direction |
|---|---|---|
| UI appears then disappears | hydration mismatch, conditional client-only state, or late CSS override | stable server skeleton + mounted-state gating only where required |
| Header/card text overlaps | old CSS layers compete with new CSS layers | final scoped CSS layer per feature, no broad global overrides |
| Notifications stale or not clearing | DB rows + fallback rows + local state not unified | single notification state owner + local state bridge for virtual rows |
| Output Activity refreshes too often | multiple refresh sources call router refresh | event-driven refresh only; no permanent route refresh loops |
| Supporting Documents canvas does not resize | legacy layout selectors win or cached CSS | strongest scoped layout layer loaded last + restart/hard refresh verification |
| Buttons freeze/hang | mutation route waits for slow sync or uncaught DB error | optimistic UI, timeout-safe server route, visible error result |
| Form data appears wrong after user switch | singleton client store kept previous user data | reset store on auth user change, key local storage by user id |

---

## Architecture rule: one owner per state

Each major page state must have exactly one owner. Other components consume it; they do not refetch independently.

| Domain | Single owner | Consumers |
|---|---|---|
| Notifications | `src/features/notifications/useOwnedNotifications.ts` | bell, unread badge, output activity refresh bridge |
| Output Activity | DB table `manager_disputer_output_approvals` + manager route read model | manager page, bell fallback, unread badge |
| Client output entitlement | `ClientOutputLimitBoundary` + `/api/client/output-entitlement` | workspace generation controls |
| Supporting Documents layout | `SupportingDocumentsLayoutEditor` + `packet-assets` storage | preview canvas, side list, controls |
| Template/source handoff | `TemplateProgressiveWorkspace` + source data flow | source notepad, packet selector, generation workspace |

If a component needs the same state, it must subscribe to the owner instead of creating a second fetch/poll loop.

---

## Page-by-page cleanup checklist

### 1. `/workspace`

**Target:** no flicker from upload/source/template/output-limit/generation UI.

Actions:

- Keep a stable skeleton for Source Data and Template Packet sections before client state loads.
- Do not show action buttons until the required state exists.
- Disable generation button only through one entitlement state path.
- Remove any parallel polling for output entitlement except the owned boundary.
- Do not render large client-only blocks with different server/client markup.
- Use compact headers with fixed min-height to prevent jumps.

Acceptance:

- Hard refresh shows stable layout within one paint.
- `Use selected template for Source Data` does not freeze.
- Source Notepad, normalized canvas, and packet selector do not overlap.

---

### 2. `/admin/output-activity-v2`

**Target:** output rows and notifications stay aligned.

Actions:

- Output rows come from `manager_disputer_output_approvals` only.
- Notification bell fallback can read pending rows, but the Output Activity page does not depend on notifications.
- Remove repeated RSC refresh loops.
- Refresh by bounded events only: focus, visibility, realtime, or mutation completion.
- Clear-history action must preserve pending per-output rows.

Acceptance:

- Pending rows remain visible after clear history.
- Confirm/Return mutates status once.
- Client bell shows confirmed/returned status.
- No endless `/admin/output-activity-v2` fetch loop.

---

### 3. Notification bell beside avatar

**Target:** stable, lightweight, usable on manager and client.

Actions:

- Bell reads from `useOwnedNotifications` only.
- Hook resets on auth user change.
- Hook listens to `notifications` and `manager_disputer_output_approvals`.
- Fallback Output Activity rows must be locally readable and clearable.
- Open/Review uses router navigation, not nested links inside clickable cards.
- Group rows by context: Manager Output Activity, Client Workspace, General.

Acceptance:

- `/api/notifications?limit=8` returns visible rows when Output Activity rows exist.
- Open/Review navigates correctly.
- Mark all read updates instantly.
- Clear read only hides read real and virtual rows for that user.

---

### 4. Supporting Documents layout editor

**Target:** maximum preview canvas without making side panels bulky.

Actions:

- Keep left and right as compact rails.
- Center canvas takes remaining width.
- Header remains sticky and visible while scrolling.
- All visible “Evidence” words become “Supporting Documents” or “Document.”
- Hide native file input UI; use styled upload card.
- Resize controls stay dense and readable.

Acceptance:

- Center white page is visibly wider.
- Side panels remain compact.
- Selector + reset toolbar stays above canvas.
- No horizontal overflow on desktop or mobile.

---

### 5. Template Packet / Source Notepad headers

**Target:** minimal, no duplication, no overlap.

Actions:

- Header uses: eyebrow, title, one short description, actions.
- Long descriptions are clamped.
- Actions wrap without colliding with title.
- “Use for Source Data” is short and consistent.
- Avoid duplicate panel title text in adjacent sections.

Acceptance:

- Screenshot areas do not overlap at 100%, 125%, or responsive widths.
- Buttons remain clickable.
- Text never spills into action area.

---

## Technical implementation rules

### Rule 1: stable skeleton first

Every async section must render a stable shell before data arrives.

Preferred pattern:

```tsx
<section className="stable-card" data-state={state}>
  <header className="stable-card-header">...</header>
  {state === 'loading' ? <StableSkeleton /> : <ReadyContent />}
</section>
```

Avoid:

```tsx
return loaded ? <BigLayout /> : null;
```

That causes layout jumps.

---

### Rule 2: visual measurements use `useLayoutEffect`

Use `useLayoutEffect` only for DOM measurement/positioning that would visibly flicker if delayed. Use normal `useEffect` for data fetching, subscriptions, and non-visual effects.

Examples that may need `useLayoutEffect`:

- flyover/popover positioning
- canvas frame measurement
- scroll-preserving sticky command bars
- auto-centering selected image after dimensions are known

Avoid using `useLayoutEffect` for normal data fetches.

---

### Rule 3: no permanent route refresh loops

Do not use permanent `setInterval(router.refresh)`.

Allowed refresh triggers:

- mutation success
- focus
- online
- visibility change
- realtime notification event
- short warmup timer with fixed stop time
- slow fallback polling owned by one store only

---

### Rule 4: fetch-first, realtime-second

Realtime should accelerate UI updates, not be the only source of truth.

Every realtime-backed component must still work through a fetch endpoint:

- Bell: `/api/notifications?limit=8`
- Output Activity: `/api/manager/output-activity?filter=all`
- Entitlement: `/api/client/output-entitlement`
- Payroll: `/api/client/payroll-profile`

If realtime fails, fetch still shows correct state.

---

### Rule 5: CSS layers must be scoped and loaded last only when intentional

Global CSS has become one of the biggest UI instability risks. New CSS must be scoped by feature root class.

Good:

```css
.source-supporting-panel .support-layout-grid.word-crop-grid { ... }
```

Bad:

```css
.panel button { ... }
```

Every new recovery CSS file must explain what it owns in the file header.

---

### Rule 6: local state must be user-scoped

Any browser storage state must include the logged-in user id.

Good:

```text
xdisputer-notification-state-v2:<userId>
```

Bad:

```text
xdisputer-state
```

This prevents manager/client account switching from leaking stale UI state.

---

## Performance plan

### Immediate wins

1. Remove duplicate notification fetchers.
2. Remove permanent route refresh loops.
3. Replace heavy null-to-content transitions with stable skeletons.
4. Lazy-load heavy client libraries only when needed.
5. Keep document preview/canvas rendering isolated from global page state.
6. Use bounded `requestAnimationFrame` for DOM patching, never broad MutationObserver loops.
7. Use scoped realtime channels and `removeChannel(channel)`, never `removeAllChannels()`.

### Medium wins

1. Create a shared `StableCard` component for headers, states, and actions.
2. Create `PageStateBoundary` for loading/empty/error/success.
3. Use route-level `loading.tsx` for slow App Router pages.
4. Add per-page fetch diagnostics in dev mode only.
5. Add CSS contract tests that grep for forbidden broad selectors.

### Long-term wins

1. Replace many recovery CSS files with feature-owned modules/components.
2. Move per-feature server reads to small read-model services.
3. Add Playwright smoke tests for major flows.
4. Add Lighthouse performance budgets.
5. Add visual regression screenshots for key pages.

---

## Guardrail checks to add

Create or extend guard scripts to catch these risks:

```text
No removeAllChannels
No setInterval(router.refresh)
No broad .panel button CSS overrides
No notification fetch outside useOwnedNotifications
No Output Activity manual inserts from route handlers
No source/template headers without compact workflow classes
No native file input visible inside Supporting Documents upload cards
```

Recommended script:

```text
scripts/website-stability-guard.mjs
```

Minimum checks:

- `OwnedNotificationDock` imports `useOwnedNotifications`
- `OutputActivityUnreadBadgeMount` imports `useOwnedNotifications`
- no `removeAllChannels` in client code
- no `setInterval(() => router.refresh` in client code
- Supporting Documents polish CSS is imported after old CSS layers
- workflow header slim CSS is imported after old header layers
- notification local storage key includes current user id

---

## Verification flow after every cleanup batch

Run in Codespace:

```bash
cd /workspaces/xDisputer || exit 1
npm run xdisputer:guard
npm run build
```

Then manual smoke test:

1. Login client.
2. Open `/workspace`.
3. Upload/review Source Notepad.
4. Select template and source data.
5. Upload Supporting Documents.
6. Arrange layout page.
7. Generate output.
8. Login manager.
9. Check bell and Output Activity.
10. Confirm/Return.
11. Login client.
12. Check bell and workspace notification.

Network expectations:

```text
/api/notifications?limit=8             200, no repeated tight loop
/api/client/output-entitlement         200, bounded refresh only
/api/manager/output-activity           200 when used
/admin/output-activity-v2              no endless reload loop
```

---

## Priority implementation sequence

### Phase 1 — stabilize current glitches

1. Add `website-stability-guard.mjs`.
2. Convert repeated refreshers to event-driven refresh only.
3. Replace remaining null renders with stable skeletons.
4. Enforce user-scoped local browser state.
5. Strengthen CSS import order documentation.

### Phase 2 — unify visual components

1. Add `StableCard`.
2. Add `StableCommandHeader`.
3. Add `StableEmptyState`.
4. Add `StableActionRow`.
5. Replace duplicated ad-hoc headers in workspace/template/source/supporting docs.

### Phase 3 — performance pass

1. Audit bundle-heavy client imports.
2. Lazy-load heavy editor/preview features.
3. Memoize derived rows and grouped notifications.
4. Remove broad MutationObservers.
5. Add page-level `loading.tsx` where server pages are slow.

### Phase 4 — production confidence

1. Add smoke test scripts.
2. Add CSS contract guards.
3. Add fetch-loop detection in dev mode.
4. Add visual baseline screenshots for major pages.

---

## Definition of done

The cleanup is complete when:

- No page visually jumps after first render.
- Manager/client account switching does not leak UI state.
- Bell, Output Activity, and workspace status stay synchronized.
- Supporting Documents canvas uses available space cleanly.
- Source/Template headers are minimal and do not overlap.
- Build and guard scripts pass.
- Manual smoke test passes from client generation through manager decision back to client notification.
