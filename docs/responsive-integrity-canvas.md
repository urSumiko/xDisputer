# xDisputer Universal Responsive Integrity Canvas

## Purpose

The responsive integrity layer is the final cross-device safety system for xDisputer. It prevents narrow monitor and mobile collapse by enforcing a last-pass layout contract after the console, account rail, template workspace, and client runtime CSS layers load.

## Runtime model

```txt
Global base reset
  -> feature CSS
  -> console/account CSS
  -> template/client runtime CSS
  -> final-responsive-integrity.css
  -> debug overlay
```

## What it protects

```txt
viewport overflow
sidebar overlap
account rail crushing the header
raw default link clusters
table overflow
oversized grids
client runtime cards
manager template studio panels
master/admin console cards
```

## Debug proof

`components/console/RenderDebugger.tsx` now reports:

```txt
Viewport width
Document scroll width
Horizontal overflow
Largest overflowing element
Responsive breakpoint token
Final responsive integrity loaded
```

## Guard

Run:

```bash
npm run responsive:guard
```

The guard verifies the final CSS layer, import order, global base contract, debugger diagnostics, and UI intelligence registration.

## SQL

No SQL is required. This is a CSS/runtime contract fix.
