# Guard Policy Contradiction Resolution Canvas

_Last updated: 2026-06-22 Asia/Tokyo_

## Purpose

This canvas is the single repo-level operating model for stopping guard spam in `Arisu-art/xDisputer`.

A guard failure is not automatically a code bug. A failure can be one of four things:

1. **Real product bug** — frontend, backend, schema, route, or service violates the active contract.
2. **Guard-policy contradiction** — one guard requires a pattern that another guard forbids.
3. **Stale guard** — a guard still protects an old migration or UI state after the repo has moved to a newer contract.
4. **Missing synchronization artifact** — lockfile, root CSS import, active connector document, or migration marker is not aligned.

The permanent rule is: **one active policy must win, and every guard must enforce that same policy.** Do not delete guards to bypass failures. Merge contradictory guards into a single upstream policy and make `scripts/guard-policy-consistency.mjs` fail early when a future contradiction is introduced.

## Documentation baseline used

### Next.js App Router CSS policy

Context7 resolved the official Next.js documentation from `/vercel/next.js`. The relevant rule is that global CSS for the App Router is imported from `app/layout.tsx` or `app/layout.js`, so xDisputer root CSS contract guards are valid when they require root layout imports for app-wide CSS.

Repo implication:

- If a guard requires `import './some-root-bundle.css';`, the CSS file must exist in `app/` and `app/layout.tsx` must import it.
- Do not scatter global CSS imports into feature components.
- Feature CSS can be modularized later, but existing guard-protected global bundles must be loaded from root until the owning guard is retired.

### Supabase query and schema policy

Context7 resolved the official Supabase documentation from `/supabase/supabase`. The relevant rules are:

- Prefer explicit column selection, for example `.select('id,name,created_at')`, over `.select('*')`.
- Limit result sets with `.limit(...)`.
- Encode schema changes as migrations, using additive changes such as `alter table ... add column` or table definitions.

Repo implication:

- Notification reads use strict canonical columns: `id,title,body,href,severity,read_at,created_at`.
- Notification writes use the canonical table shape: `recipient_user_id`, `recipient_role`, `title`, `body`, `href`, `severity`, `created_by`.
- The `notifications` table schema must be protected by migrations, not runtime fallback branches.

### npm install policy

Context7 resolved npm CLI documentation from `/npm/cli`. The relevant rule is that `npm ci` is for automated clean installs and fails when `package.json` and `package-lock.json` are not synchronized.

Repo implication:

- `package-lock.json` drift is a repo contract failure, not an install annoyance.
- Use `node scripts/dependency-lock-doctor.mjs` before `npm ci` when dependency drift is suspected.
- Do not hide `npm ci` failures by switching the sync runner permanently to a loose `npm install`.

### GitHub repository policy

The active GitHub target is `Arisu-art/xDisputer` on `main`. Local and Codespace sync must bind to the canonical remote before reset, stash, install, Supabase push, or guard execution.

Repo implication:

- Use `scripts/xdisputer-active-sync.sh` through `npm run active:sync`.
- Remote validation must normalize HTTPS/SSH and optional `.git` instead of using brittle Bash regex syntax.
- Active connector state belongs in `docs/active-connector-inheritance.md`.

## Current active repo contracts

| Area | Winning policy | Source of truth | Guard category |
| --- | --- | --- | --- |
| Repository binding | `Arisu-art/xDisputer` on `main` | `docs/active-connector-inheritance.md`, `scripts/xdisputer-active-sync.sh` | connection inheritance |
| Dependency install | deterministic `npm ci` with synchronized lockfile | `package.json`, `package-lock.json`, `scripts/dependency-lock-doctor.mjs` | package-lock policy |
| Notification schema | `strict-canonical-columns` | `src/features/notifications/notification-ui-contract.ts`, Supabase migrations | notification UI/schema/output/performance |
| Notification query | explicit column projection + `.limit(...)` | `lib/notifications/notification-service.ts` | performance + notification guards |
| Root CSS | global CSS imported by `app/layout.tsx` | `app/layout.tsx`, guard-detected root CSS imports | layout/CSS/template/client guards |
| Guard bundle order | consistency guard before module guards | `scripts/guard-bundle-runner.mjs` | all bundles |

## Permanent contradiction prevention model

### Layer 0 — Documentation and active policy

Every guard family must point to one active policy document. For repo-level contradiction prevention, this canvas is the highest-order policy file.

Required documents:

- `docs/guard-policy-contradiction-resolution-canvas.md`
- `docs/active-connector-inheritance.md`
- `docs/xdisputer-active-sync-runbook.md`
- domain-specific canvases, such as notification UI, performance, template workspace, and modernization canvases.

### Layer 1 — Contract files

Feature contracts must be machine-readable TypeScript or SQL where possible.

Examples:

- `src/features/notifications/notification-ui-contract.ts`
- `src/features/performance/performance-contract.ts`
- `src/features/manager-output-activity/output-activity-contract.ts`
- Supabase migration SQL files.

Policy:

- A feature contract beats a stale guard.
- A migration beats runtime fallback after the migration is active.
- A root layout import requirement beats a missing CSS import when the CSS file exists and is app-wide.

### Layer 2 — Consistency guard

`scripts/guard-policy-consistency.mjs` must run before specialized guards. Its job is to catch impossible combinations early:

- Notification contract says strict canonical schema, but a guard still requires optional-column fallback.
- A guard requires root layout CSS, but `app/layout.tsx` does not import it.
- `package.json` and `package-lock.json` drift.
- Guard bundle runner does not execute consistency checks before specialized guards.

Add future cross-cutting contradictions here before adding another module guard.

### Layer 3 — Module guards

Module guards should only validate one domain at a time:

- UI ownership and DOM markers.
- Schema column contracts.
- Route/service ownership.
- CSS ownership.
- Template workspace hub contract.
- Performance constraints.

Module guards must not encode repo-wide policy if `guard-policy-consistency` can derive it.

## Guard contradiction decision tree

When a new guard fails, use this order.

### Step 1 — Classify the failure

Ask which class it belongs to:

| Failure signal | Classification | Correct action |
| --- | --- | --- |
| Missing root CSS import | synchronization artifact | add import to `app/layout.tsx`; improve consistency scanner if pattern was missed |
| `npm ci` lockfile mismatch | synchronization artifact | run dependency lock doctor; commit lockfile |
| Guard demands fallback but contract says strict | guard-policy contradiction | update stale guard to strict policy |
| Guard demands strict but code uses fallback | real/stale code bug | remove fallback if migrations guarantee schema |
| Guard demands old UI component/class | stale guard or stale code | inspect current contract; remove retired UI or update guard |
| Guard demands service centralization | real architecture bug | route must delegate to service/repository layer |
| Guard flags `.select('*')` or no `.limit()` | real performance bug | use explicit projection and row cap |

### Step 2 — Find the winning source of truth

Priority order:

1. `docs/guard-policy-contradiction-resolution-canvas.md`
2. Domain contract file, for example `notification-ui-contract.ts`
3. Active migration SQL
4. Domain canvas
5. Specialized guard
6. Old change report or old guard literal

### Step 3 — Fix the smallest true owner

Examples:

- Missing CSS import: fix `app/layout.tsx`, not the component.
- Stale notification fallback guard: fix the stale guard, not the service.
- Missing schema column: add a Supabase migration, not a runtime compatibility branch.
- Missing dependency lock entry: repair `package-lock.json`, not `npm ci`.

### Step 4 — Upgrade consistency guard

If the failure could happen again, add a general check to `scripts/guard-policy-consistency.mjs`.

Examples already covered:

- Root CSS imports required by `must(layout, ...)` or `has('app/layout.tsx', ...)`.
- Notification strict-schema contradictions.
- Package-lock dependency drift.

Future checks to add:

- Route handler must not bypass service layer when a domain service exists.
- Supabase schema-changing migrations must include `notify pgrst, 'reload schema'` when PostgREST cache can be affected.
- Guards must not reference deleted components unless the same guard also owns the retirement plan.
- Feature-owned CSS must include an owner marker or contract variable.

## Backend policy

### Supabase and SQL

1. Add schema changes through migrations.
2. Prefer additive DDL: `create table if not exists`, `alter table ... add column if not exists`, `create index if not exists`.
3. Reload PostgREST schema cache when migrations affect API-exposed columns.
4. Use RLS policies in the same migration family as the table/feature.
5. Never fix missing columns by adding indefinite runtime fallback if the canonical migration exists.

### Service and route ownership

1. API routes should delegate to service functions.
2. Services should own Supabase query construction.
3. Repositories should own reusable table access when repeated.
4. Guards should check service delegation, not duplicate route internals.

## Frontend policy

### Root layout and CSS

1. App-wide CSS must be imported in `app/layout.tsx`.
2. Guard-protected CSS files in `app/` must have a clear contract marker or owning guard.
3. Retired UI classes/components must be forbidden in both components and CSS.
4. Do not add a new root CSS file without either:
   - importing it in `app/layout.tsx`, or
   - documenting why it is not app-wide and not guard-owned.

### UI ownership

1. A UI surface has one owner component.
2. Shared shells delegate to owner components instead of mounting duplicate docks/popovers directly.
3. Guards should check owner boundaries and markers, not arbitrary formatting.

## Guard authoring rules

### Good guard rule

A good guard checks active architecture:

```js
must(service, ".select('id,title,body,href,severity,read_at,created_at')", 'notification read service must use canonical columns');
```

### Bad guard rule

A bad guard preserves an obsolete transition state:

```js
must(readService, 'missingOptionalColumn', 'notification reads must tolerate optional column drift');
```

This becomes invalid once the contract says `strict-canonical-columns` and migrations guarantee the column shape.

### Guard rule template

Every new guard rule must answer:

1. Which contract owns this rule?
2. Which file is the source of truth?
3. Is this permanent policy or temporary migration support?
4. Which consistency check prevents contradiction with other guards?
5. What command proves the guard passes?

## Standard execution order

Use this order after every repo-wide fix:

```bash
npm ci --no-audit --no-fund
node scripts/guard-policy-consistency.mjs
npm run connections:doctor
npm run ui-source:guard
npm run console-roadmap:guard
npm run template-execution:guard
npm run manager-template:roadmap
npm run manager-template:db-guard
npm run typecheck
npm run build
```

Equivalent full command:

```bash
npm run xdisputer:guard
```

When syncing a Codespace:

```bash
npm run active:sync -- --reset-local --verify
```

When pushing Supabase migrations after verifying the linked project:

```bash
npm run active:sync:db
```

## Emergency anti-spam workflow

When guards fail one after another:

1. Run `node scripts/guard-policy-consistency.mjs` first.
2. If it fails, fix the contradiction first.
3. If it passes, run the specific failing guard directly.
4. Patch the source of truth, not the symptom.
5. Add a new consistency check only if the failure is cross-cutting.
6. Then run `npm run ui-source:guard` and `npm run xdisputer:guard`.

## Do not do this

- Do not delete guards to make the terminal green.
- Do not silence a real guard with a looser string check.
- Do not bring back compatibility fallback after the contract says strict canonical schema.
- Do not switch permanent install logic from `npm ci` to `npm install`.
- Do not edit generated cache files as a real fix.
- Do not add root CSS without root layout import when a guard expects global behavior.

## Definition of done

A guard contradiction fix is complete only when all are true:

1. The failing guard passes.
2. Related sibling guards pass.
3. `scripts/guard-policy-consistency.mjs` would catch the same class of contradiction earlier next time.
4. The source-of-truth contract or canvas explains the policy.
5. `npm run xdisputer:guard` reaches typecheck/build instead of failing in guard-policy drift.

## Current high-priority permanent checks

| Priority | Permanent check | Current status |
| --- | --- | --- |
| P0 | Notification strict canonical schema contradictions | implemented in `guard-policy-consistency` |
| P0 | Root layout CSS import drift | implemented in `guard-policy-consistency` |
| P0 | Package lock drift before `npm ci` | implemented in `guard-policy-consistency` and `dependency-lock-doctor` |
| P1 | Guard bundle starts with consistency guard | implemented in `guard-bundle-runner` |
| P1 | Route-to-service ownership drift | next recommended consistency expansion |
| P1 | Schema-changing SQL PostgREST reload drift | next recommended consistency expansion |
| P2 | Retired UI marker/class contradictions | next recommended consistency expansion |
| P2 | Feature CSS owner marker drift | next recommended consistency expansion |
