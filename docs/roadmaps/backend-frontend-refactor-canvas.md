# Backend and Frontend Refactor Canvas

## Goal

Refactor xDisputer without breaking the current working product. Each change must improve traceability, reduce ownership drift, and keep backend/frontend logic in the correct place.

## Evidence used

- Existing repo roadmap and guard architecture.
- Current manager/admin route structure and account profile route ownership.
- Current CSS ownership and root bundle architecture.
- Current notification, output activity, and account rail contracts.
- Context7 guidance used for this canvas:
  - Next.js App Router: global CSS belongs in the root layout and project code should be split by feature or route for maintainability.
  - Supabase SSR: server clients should be instantiated per request and reused through server-side helpers/services.

## Traceability chain

```text
Request -> canvas -> affected files -> feature contract -> service/helper refactor -> guard -> verification
```

---

# Backend: 5 critical problems

## B1. Generation route is too large and mixes multiple responsibilities

### Cause
`app/api/generation-runs/route.ts` currently owns request validation, entitlement checks, insert flow, manager notification creation, integrity logging, and response formatting.

### Effect
- Hard to change safely.
- Easy to break output activity, entitlement, or observability in the same patch.
- Testing and root-cause tracing are slow.

### Affected files
- `app/api/generation-runs/route.ts`
- `lib/saas/access-entitlement.ts`
- `lib/saas/integrity-ledger.ts`
- `lib/notifications/notification-write-service.ts`
- `src/features/manager-output-activity/output-activity-contract.ts`

### Refactor target
Split this route into feature-owned services:
- request parsing/validation service
- entitlement gate service
- generation run persistence service
- output activity notification service
- response presenter

### Owner
`src/features/generation-runs/`

---

## B2. Manager payroll save flow still owns business rules inside the route

### Cause
`app/api/manager-console/payroll/route.ts` normalizes employment type, parses amounts, builds the record, and persists the table row in one file.

### Effect
- Payroll policy is tied to HTTP handling.
- Reuse is hard.
- Future manager workspace pages will duplicate logic.

### Affected files
- `app/api/manager-console/payroll/route.ts`
- `lib/saas/manager-user-settings.ts`

### Refactor target
Move metadata normalization and record construction into a dedicated payroll settings service.

### Owner
`src/features/manager-console/payroll-settings-service.ts`

---

## B3. Account profile route has route-local revalidation ownership

### Cause
`app/api/account/profile/route.ts` hardcodes the full revalidation list.

### Effect
- Easy to miss a route after adding new account-facing pages.
- Revalidation policy is not shared or testable.

### Affected files
- `app/api/account/profile/route.ts`
- account-facing console pages

### Refactor target
Move account profile revalidation paths into a dedicated helper/contract.

### Owner
`src/features/account-profile/account-profile-revalidation.ts`

---

## B4. Backend feature boundaries are inconsistent between `lib/` and `src/features/`

### Cause
Some business rules live in `lib/saas/*`, some in `src/features/*`, and routes still import directly from both layers.

### Effect
- Ownership is ambiguous.
- Refactors cross too many directories.
- Backend contracts drift faster than UI contracts.

### Affected files
- `app/api/**/*`
- `lib/saas/**/*`
- `src/features/**/*`

### Refactor target
Use this rule:
- `app/api/*` = thin route only
- `src/features/*` = business service and contract
- `lib/*` = shared infrastructure or storage adapters only

### Owner
`src/features/architecture/backend-frontend-refactor-contract.ts`

---

## B5. SQL and schema traceability is still document-light for feature changes

### Cause
SQL expectations exist, but not every feature has a direct canvas-level database dependency record.

### Effect
- Safe migration order is harder to track.
- Schema changes can still drift from code assumptions.

### Affected files
- `supabase/migrations/*`
- feature contracts for notifications, account profile, output activity

### Refactor target
Each backend feature change must record:
- required SQL file
- expected columns/functions
- schema reload requirement
- rollback expectation

### Owner
Feature canvas + contract registry

---

# Frontend: 5 gap problems

## F1. Root CSS ownership is still too global

### Cause
xDisputer still uses large root CSS bundles with many imports.

### Effect
- Layout drift can still happen.
- Small UI changes can create distant side effects.
- Guard mismatches happen when explicit root imports and bundled imports diverge.

### Affected files
- `app/layout.tsx`
- `app/root-css-*.css`
- feature-owned CSS files in `app/`

### Refactor target
Keep only true global contracts in root bundles. Move feature geometry closer to feature owners.

### Owner
`src/features/app-shell/`

---

## F2. Admin page still mixes data shaping and UI composition

### Cause
`app/admin/page.tsx` still contains formatting and presentation helpers alongside route-level composition.

### Effect
- Manager console UI refactors remain expensive.
- Reusable presentation rules are harder to share with other manager surfaces.

### Affected files
- `app/admin/page.tsx`

### Refactor target
Move formatting/presentation helpers into feature-owned presenter modules.

### Owner
`src/features/manager-console/admin-page-presenters.ts`

---

## F3. Components and features are still split across two ownership trees

### Cause
UI code is shared between `/components` and `/src/features`, but not every feature has a clear owner boundary.

### Effect
- Developers have to guess where UI belongs.
- Contract drift happens between shell components and feature components.

### Affected files
- `components/**/*`
- `src/features/**/*`

### Refactor target
Use this rule:
- `components/` = shell/shared primitives only
- `src/features/` = feature-owned UI, presenters, contracts, and services

### Owner
`src/features/architecture/backend-frontend-refactor-contract.ts`

---

## F4. Manager/master/client surface contracts are not yet unified into a UI handoff map

### Cause
There are many guard files and contracts, but not one canvas-level handoff map for product surfaces.

### Effect
- UI/UX changes are safe only for people who already know the repo.
- Design intent is harder to mirror into Figma or review with a traceable checklist.

### Affected files
- console shell contracts
- account rail contracts
- client workspace contracts
- manager console contracts

### Refactor target
Maintain a Figma-ready surface map with:
- surface owner
- slot owner
- data owner
- CSS owner
- guard owner

### Owner
Canvas + feature contracts

---

## F5. Popover, workflow, and card geometry are still validated mainly by guards instead of dedicated UI contracts

### Cause
Many layout invariants are enforced by string-based guard checks rather than a small set of reusable UI contract registries.

### Effect
- UI refactors remain brittle.
- Changing naming or import paths causes false failures.

### Affected files
- `scripts/*guard.mjs`
- account rail, manager console, client workspace CSS and components

### Refactor target
Prefer feature contract registries that guards read, instead of hardcoding all ownership strings directly inside guards.

### Owner
`src/features/architecture/backend-frontend-refactor-contract.ts`

---

# Figma-ready handoff map

## Page 1 — Manager console
- Frame: Monitoring
- Frame: Access control of user
- Frame: Output Activity
- Frame: Request
- Shared component: manager account card
- Shared component: manager KPI grid

## Page 2 — Account rail and shell
- Frame: Console header ratio grid
- Component: account menu
- Component: owned notification dock
- Component: account avatar popover

## Page 3 — Client workspace
- Frame: dashboard command cards
- Frame: metrics and recent work rows
- Component: workspace content width contract

---

# Execution order

## Backend execution
1. Split payroll route into service and route.
2. Centralize account profile revalidation.
3. Split generation route into feature services.
4. Register per-feature SQL dependency notes.
5. Move route-local business logic behind feature contracts.

## Frontend execution
1. Move admin page presenters out of the page file.
2. Reduce root bundle ownership for feature geometry.
3. Define shell/feature placement rules in one contract.
4. Add Figma-ready handoff mapping to feature contracts.
5. Make guards read contract registries instead of raw duplicated strings.

---

# Verification

```bash
node scripts/backend-frontend-refactor-guard.mjs
npm run manager-console:guard
npm run ui-source:guard
npm run typecheck
npm run build
```
