# Manager/Master Instant Workflow Canvas

## Title

**xDisputer Manager/Master Instant Workflow Canvas — Fast Shell First, Data Second, Smooth Motion Everywhere**

## Main problem

Client workspace already feels smoother because it has a stable shell and more client-side perceived feedback. Manager and master routes can feel slower because they wait for protected server reads, summary RPCs, directory RPCs, entitlement reads, and attention queues before the full page appears.

The fix is not to weaken auth or pretend there is zero latency. The fix is to make the console shell appear immediately, stream route content behind a meaningful skeleton, and remove sluggish hover/floating effects that animate expensive visual properties.

## Strong analogy

Client workspace feels like the front desk is already open while documents are prepared in the back.

Manager and master used to feel like the door stayed locked until every report was printed.

The new rule:

```text
Open the office immediately.
Show the role-specific console shell now.
Load private account data behind the shell.
Keep buttons and cards responsive using transform/opacity-only motion.
```

## Existing logic merged

Existing Phase 12 performance roadmap already identified the target architecture:

```text
fast shell first
parallel data second
heavy tooling only when needed
route-level loading states
paginated account datasets
private data stays protected
```

This implementation merges that roadmap into manager/master routes by adding shared `ConsoleInstantLoading` route skeletons and a hardened instant interaction layer.

## 5W + HOW

### Who

- Manager account users
- Master account users
- Client users through global float consistency

### What

- Shared console loading shell
- Manager route loading states
- Master route loading states
- Smooth global float feedback
- Overflow containment for account datasets
- Reduced-motion and slow-update safety

### When

Use this pattern for every protected console route that waits for Supabase/auth/account data.

### Where

```text
components/console/ConsoleInstantLoading.tsx
app/admin/loading.tsx
app/admin/access/loading.tsx
app/master/loading.tsx
app/master/accounts/loading.tsx
app/master/workspaces/loading.tsx
app/instant-interaction-performance.css
scripts/instant-performance-guard.mjs
```

### Why

Next.js route loading files provide immediate fallback UI while server route content streams. Manager/master account pages depend on private Supabase reads and should therefore show a meaningful authenticated console shell instead of feeling stuck.

### How

```text
route navigation
→ shared layout remains visible
→ loading.tsx renders ConsoleInstantLoading immediately
→ server page continues requireRole + RPC reads securely
→ final page swaps in when data is ready
→ interactions use transform/opacity-only motion
→ reduced-motion users get no large movement
```

## What loads first

- Console shell skeleton
- Sidebar shape
- Header shape
- Metric placeholder cards
- Dataset placeholder cards
- Global float/motion CSS

## What loads later

- Supabase role check result
- Manager/master summary RPCs
- Paginated account datasets
- Entitlement rows
- Attention queues

## What is cached

- Static CSS
- Static JS chunks
- Reusable loading shell component
- Deterministic route skeleton markup

## What is paginated

- Manager client directory
- Master account directory
- Master workspace directory
- Future audit and report datasets

## What is refreshed

- Route-scoped manager/master datasets after actions
- Auth/session state after login/logout
- Account status after approve/reject/activate/disable actions

## What fallback appears

- ConsoleInstantLoading for manager/master routes
- Skeleton lines/cards for metrics and datasets
- Existing error cards for failed RPCs
- Existing disabled/action state for unavailable actions

## What should not happen

```text
Do not weaken requireRole.
Do not cache private user/account data publicly.
Do not remove RLS assumptions.
Do not animate box-shadow as part of hover feedback.
Do not animate width, height, margin, padding, top, left, or other layout properties.
Do not use loading UI to hide backend errors.
Do not load every account row into the browser.
Do not replace paginated server-side directory queries with client-side filtering.
```

## Definition of done

- Manager console shows an instant loading shell.
- Manager access directory shows an instant loading shell.
- Master console shows an instant loading shell.
- Master accounts shows an instant loading shell.
- Master workspaces has the same loading pattern.
- Floating hover effect feels consistent across client, manager, and master.
- Large shell surfaces no longer feel sluggish on hover.
- Reduced-motion users receive near-zero motion.
- Guards, typecheck, and build pass.
