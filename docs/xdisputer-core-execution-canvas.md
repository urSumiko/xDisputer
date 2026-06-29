# xDisputer Core Execution Canvas

## Project

Repository: `Arisu-art/xDisputer`

Primary goal: build xDisputer as a production-grade, fast, smooth, responsive, modern SaaS web app. The GitHub repository is the source of truth. Every implementation must be logical, connected, safe to apply, and validated before it is considered complete.

## Default development response format

1. What I understood
2. Tools to use and why
3. Current repo areas to inspect
4. Logical implementation plan
5. Files to change
6. Code or patch
7. SQL Editor code, if needed
8. Terminal commands to run
9. Validation checklist
10. Expected after chat

## Active toolchain

### GitHub: source-of-truth coding layer

- Inspect the current repo structure before suggesting code.
- Read existing files before modifying anything.
- Avoid blind rewrites.
- Prefer small, surgical patches over full rebuilds.
- Track files changed, why they changed, and what remains untouched.
- Preserve existing working logic unless the task requires replacing it.
- After code changes, provide exact terminal commands to test, typecheck, build, and run.

### Context7: current framework/API accuracy layer

- Use current documentation before relying on framework or library syntax.
- Use especially for Next.js, React, Tailwind, Supabase, shadcn/ui, auth, routing, server actions, caching, forms, and deployment-sensitive code.
- Do not invent APIs.
- Confirm version-sensitive syntax before coding.

### Figma-style UI/UX layer

- Plan layout hierarchy, spacing, typography, responsive behavior, and modern visual polish before coding UI.
- Translate UI plans into reusable frontend components and layout contracts.
- Prioritize simple, clean, premium SaaS design.
- Use accessible color contrast, predictable spacing, smooth transitions, skeleton loading, and responsive layouts.
- Avoid over-designed UI that slows the app or creates unnecessary complexity.

### Miro-style architecture and workflow layer

Before coding complex features, map the flow:

```text
input -> validation -> state -> backend action -> UI update -> error fallback -> success result
```

Use this for system maps, feature flows, state diagrams, role flows, manager/client workflows, approval flows, and bug-analysis maps.

### Supabase: backend/auth/database/security layer

Use Supabase when database, auth, storage, realtime, or backend runtime logic is required.

When Supabase is involved, provide:

1. SQL Editor code
2. RLS policies
3. Indexes
4. Test queries
5. Expected successful result
6. Likely permission/RLS errors and fixes

Rules:

- Never expose service role keys in frontend code.
- Use Row Level Security for user-owned or role-based data.
- Add indexes for search, filters, dashboard counts, status queries, and manager/client workflows.
- Prefer server-side pagination and RPC summary functions for large data.
- Avoid loading every row into the browser.

### Airtable: structured planning/control layer

- Use Airtable for structured project records, feature tracking, content tables, requirements, template metadata, task status, and review logs.
- Do not treat Airtable as the primary production app database when Supabase is already the runtime backend.

## Performance rules

- Target zero avoidable lag, not fake zero-lag claims.
- Use instant perceived feedback: loading shells, optimistic UI, skeleton states, progressive rendering, and route refresh only where needed.
- Avoid heavy client-side data loading.
- Use server-side search, pagination, filtering, and summary queries.
- Split large components into stable reusable sections.
- Keep bundle size controlled.
- Avoid unnecessary dependencies.

For every performance-sensitive feature, document:

```text
what loads first
what loads later
what is cached
what is paginated
what is refreshed
what fallback appears on error
```

## Coding rules

- Understand the existing repo first.
- Create a short plan before coding.
- Implement only the needed files.
- Avoid conflicts.
- Anticipate common errors before they happen: missing imports, wrong paths, invalid types, hydration errors, undefined data, null auth/session state, database permission errors, RLS policy blocks, build errors, and stale cache issues.
- Use TypeScript-safe patterns.
- Use clear component names.
- Reuse utilities where needed.
- Avoid duplicate logic.
- Avoid hardcoded magic values unless documented.
- Do not break existing working routes.

## UI Consistency Recovery Canvas

### Problem

Some UI areas are inconsistent because pages and CSS layers have grown independently. This creates multiple competing owners for theme, spacing, layout, cards, headers, sidebars, buttons, forms, tables, and responsive behavior.

### Goal

Create one unified visual system that all users and roles follow:

```text
Client workspace
Manager workspace
Manager console
Master console
Login/auth screens
Template studio
Source data workflow
Output review
Account directory
```

### Theme ownership model

Use one theme foundation for color tokens, typography scale, radius tokens, shadow/elevation tokens, spacing tokens, button variants, card surfaces, form controls, table/dataset surfaces, command headers, sidebars, responsive breakpoints, and motion durations.

### Layout contract model

Every complex page should have named layout ownership:

```text
page shell
sidebar
header
command zone
dataset card
form toolbar
content grid
action rail
status/alert panel
pagination
```

Critical rule:

```text
One surface = one layout owner.
```

### Recommended UI repair order

1. Audit CSS imports and duplicate theme rules.
2. Create or extend a final theme contract layer.
3. Create layout contract attributes for complex surfaces.
4. Normalize buttons, form fields, cards, and dataset/table surfaces.
5. Add skeleton, empty, loading, and error states for slow workflows.
6. Add smooth transitions where state changes are meaningful.
7. Add guards to prevent layout/theme regression.
8. Validate on desktop, tablet, and mobile widths.

### Future direct-coding instruction

For future xDisputer instructions, default to coding directly in `Arisu-art/xDisputer` after inspection, unless the request is only planning or clarification. Keep changes surgical, safe, and validated.

## Standard validation commands

```bash
git status --short
git pull --ff-only --autostash origin main
node scripts/ui-layout-contract-guard.mjs 2>/dev/null || true
node scripts/ui-collapse-contract-guard.mjs 2>/dev/null || true
node scripts/ai-ui-contract-guard.mjs 2>/dev/null || true
node scripts/ai-backend-contract-guard.mjs 2>/dev/null || true
npm run responsive:guard
npm run typecheck
npm run build
npx next dev -H 0.0.0.0 -p 3000
```

Use this SQL section when no database change is required:

```sql
-- No Supabase SQL required.
```
