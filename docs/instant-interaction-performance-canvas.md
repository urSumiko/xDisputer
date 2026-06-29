# xDisputer Instant Interaction Performance Canvas

## Title

**xDisputer Instant Interaction Performance Canvas — Client Smoothness for Manager and Master Workflows**

## Main problem

Client surfaces felt smoother because they have fewer dense cards and datasets. Manager and master pages contain more cards, directory controls, sidebar actions, and operational lists. The previous global theme applied broad transitions, and the triad theme animated dense console cards like smaller client cards.

## Goal

Make client, manager, and master interactions feel immediate while keeping one professional product language.

## 5W + HOW

### Who

Client, manager, and master users.

### What

The instant performance layer owns interaction motion:

- global float feedback
- fast hover and active response
- dense console animation reduction
- targeted transitions
- overflow containment
- reduced-motion fallback

### When

Use it for visible account surfaces. Prefer CSS transform feedback over JavaScript animation.

### Where

```text
app/instant-interaction-performance.css
scripts/instant-performance-guard.mjs
```

Import order:

```text
ui-theme-contracts.css
ui-theme-triad.css
instant-interaction-performance.css
ui-layout-contracts.css
```

### Why

Static descendants should not animate. Interactive controls should respond quickly. Dense manager and master cards should not run the same entrance animation as smaller client surfaces.

### How

```text
static descendant -> no transition
button/nav/card/action -> short transform/color transition
dense console card -> no entrance animation
shell/header -> short ready animation
hover capable device -> float transform
reduced motion user -> no motion
```

## What is coded

```text
app/instant-interaction-performance.css
- resets broad static transitions
- opts in controls/cards/surfaces to fast transitions
- adds global float to client, manager, and master
- disables dense console card entrance animations
- keeps short shell/header ready animation
- compresses duplicate badges/actions into metadata-style pills
- keeps overflow containment for dense surfaces
- respects prefers-reduced-motion

scripts/instant-performance-guard.mjs
- verifies the instant layer exists
- verifies global float exists
- verifies dense console optimization exists
- verifies no transition-property: all
- verifies no blur effect
```

## What is not coded

```text
No Supabase SQL.
No auth route changes.
No generation changes.
No template execution changes.
No JavaScript animation dependency.
```

## Validation commands

```bash
node scripts/instant-performance-guard.mjs
node scripts/triad-theme-guard.mjs
npm run theme:guard
npm run layout:guard
npm run responsive:guard
npm run typecheck
npm run build
```

## Expected behavior

```text
Client side remains smooth.
Manager and master pages feel faster.
Float interaction is global across account types.
Buttons, nav, cards, and action controls respond immediately.
Reduced-motion users do not receive motion.
Overflow stays contained on dense console and directory surfaces.
```
