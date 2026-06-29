# xDisputer Unified UX Theme Governance Canvas

## Title

**xDisputer Unified UX Theme Governance Canvas — One Product, Many Functions, One Visual System**

## Main problem

The website has many functional surfaces: client workspace, manager workspace, master console, auth, templates, source review, outputs, AI panels, and evidence editing. Each surface grew its own CSS layer, so some pages felt like different products.

The fix is not to redesign every component. The fix is to define one global theme contract and make feature CSS customize through approved tokens and data hooks.

## Strong analogy

xDisputer UI is like a credit-dispute packet.

- The global theme is the packet cover and filing standard.
- Each feature is a document section.
- Custom feature styling is allowed only when it follows the filing standard.
- Layout contracts decide where each section goes.
- Theme contracts decide how each section feels.

No page should invent a separate product identity.

## 5W + HOW

### Who

All users share the same visual foundation:

- Client users
- Manager users
- Master users
- Auth users
- Future admin / AI review users

### What

The global UI contract owns:

- Color tokens
- Surface styles
- Typography rhythm
- Radius and shadows
- Button styles
- Input styles
- Status tones
- Loading skeletons
- Safe motion
- Debuggable global/custom scope markers

### When

Use the global theme by default for every new page, component, panel, table, card, form, and workflow step.

Use feature customization only when the function needs local emphasis, not a new visual identity.

### Where

Global theme lives in:

```text
app/ui-theme-contracts.css
```

Final geometry lives in:

```text
app/ui-layout-contracts.css
```

Root wiring lives in:

```text
app/layout.tsx
```

Typed governance helpers live in:

```text
lib/ui-intelligence/theme-governance.ts
```

Theme guards live in:

```text
scripts/theme-consistency-guard.mjs
scripts/theme-governance-contract-guard.mjs
```

### Why

A production SaaS must feel consistent across roles and workflows. Consistency improves trust, speed, debugging, accessibility, and perceived performance.

### How

Use this decision flow before adding UI code:

```text
input: new UI element
→ is it a card/surface?
  → use global card tokens or data-theme-surface="card"
→ is it a button/action?
  → primary action: data-theme-action="primary"
  → secondary action: data-theme-action="secondary"
→ is it a form field?
  → use existing input/select/textarea contract
→ is it a status?
  → success/warning/danger/info semantic state first, theme style second
→ is it loading async data?
  → use data-theme-loading="skeleton" or existing loading shell
→ is it layout/geometry?
  → do not solve in theme CSS; use ui-layout-contracts.css
→ is it role-specific?
  → use data-theme-custom="client|manager|master|auth" only for local accent
```

## Else-if implementation rules

```text
IF the UI issue is color/radius/shadow/typography/button/input/state:
  edit app/ui-theme-contracts.css.

ELSE IF the UI issue is grid/flex/sidebar/header/overflow/position:
  edit app/ui-layout-contracts.css.

ELSE IF the UI issue is data loading or API latency:
  add skeleton/loading state in the component and keep data fetching server-side where possible.

ELSE IF the UI issue is Supabase/auth/database permission:
  do not fix with CSS; inspect backend route, RLS, SQL, and session state.

ELSE IF the UI issue is per-role behavior:
  keep global theme; use role data hooks for minor emphasis only.

ELSE:
  inspect the component owner first, then add the smallest scoped patch.
```

The same decision model is available in code through:

```ts
classifyThemeGovernanceIssue(input)
themeGovernanceChecklist(role)
```

## Global vs customized organization

### Global

Global tokens and shared styles belong to:

```text
app/ui-theme-contracts.css
```

Use for:

- Cards
- Buttons
- Inputs
- Badges
- Alerts
- Loading shells
- Typography tone
- Focus ring
- Motion safety

### Customized

Feature customization should use data hooks:

```tsx
<section data-theme-custom="client">
<section data-theme-custom="manager">
<section data-theme-custom="master">
<section data-theme-custom="auth">
```

Element-level customization should use:

```tsx
<div data-theme-surface="card">
<button data-theme-action="primary">
<div data-theme-loading="skeleton">
<input data-theme-control="input" />
```

Customization should not use random one-off colors or shadows.

## Performance model

### What loads first

- HTML shell
- global CSS tokens
- layout contracts
- visible route content

### What loads later

- user-specific data
- dashboard counts
- table datasets
- AI reviews
- generated outputs

### What is cached

- static CSS
- static JS chunks
- deterministic UI shell

### What is paginated

- account directories
- client/manager datasets
- future audit logs
- future AI request logs

### What is refreshed

- route-scoped datasets after action
- auth/session state after login/logout
- generation output after successful run

### What fallback appears

- skeleton loading for async surfaces
- alert panel for errors
- disabled action state for blockers
- no horizontal page overflow

## What not to do

```text
Do not create a new global theme file for every page.
Do not add heavy blur/backdrop-filter effects for basic cards.
Do not use transition-property: all.
Do not animate layout-heavy properties like width/height on large sections.
Do not hardcode one-off colors when a token exists.
Do not use CSS to hide backend/auth/RLS errors.
Do not let AI output directly choose destructive UI states.
Do not override geometry in theme CSS.
Do not make role-specific pages feel like separate products.
Do not break existing deterministic generation behavior for visual polish.
```

## Debugging checklist

1. Confirm `app/layout.tsx` imports `ui-theme-contracts.css` before `ui-layout-contracts.css`.
2. Confirm `<body>` has `data-theme-contract="xdisputer-unified"`.
3. Confirm `<body>` has `data-ui-scope="global"`.
4. Confirm visual issue is classified as theme, layout, loading, or backend.
5. Use theme CSS for visual tone.
6. Use layout CSS for geometry.
7. Use component code only when state/data/render logic is wrong.
8. Run `npm run theme:guard`.
9. Run `npm run theme-governance:guard`.
10. Run `npm run layout:guard`.
11. Run `npm run responsive:guard`.
12. Run `npm run typecheck` and `npm run build`.

## Ready-to-code rule for future features

Every new UI feature must answer:

```text
What function does this serve?
Who uses it?
Where does it live?
When does it load?
Why does it need custom styling?
How does it follow the global theme?
What should not happen?
```

If it cannot answer those questions, do not add new UI code yet.

## Definition of done

A UI task is complete when:

- it uses the global theme tokens,
- it uses layout contracts for geometry,
- it has loading and error states if async,
- it avoids heavy visual effects,
- it works across client/manager/master/auth surfaces,
- the guards pass,
- typecheck passes,
- build passes,
- the expected user behavior is documented.
