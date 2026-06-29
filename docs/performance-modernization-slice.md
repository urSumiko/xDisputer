# Performance Modernization Slice

## Goal

Make the website smoother by reducing default client-side work while preserving current product behavior.

## Coded actions

1. Lazy debug mount stays active only in development or explicit debug query mode.
2. Source-data readiness logic is owned by `src/features/source-data/source-readiness.ts`.
3. Generation readiness logic is owned by `src/features/generation/readiness.ts`.
4. AI insight panel loads dynamically inside `components/SourceReviewAiPanel.tsx`.
5. AI review client loads only when the user runs the AI review action.
6. `scripts/performance-modernization-guard.mjs` protects the performance contract.
7. `scripts/modernization-boundary-guard.mjs` runs the performance guard.

## Deferred actions

1. Split `GuidedSourceDataFlow.tsx` JSX into stage-owned feature components.
2. Lazy-load the evidence stage after extracting it into a small component.
3. Move one production API route to validation, policy, service, repository, response.
4. Install Zod and TanStack Query after local package lock sync.
5. Start reducing global CSS after each surface has feature ownership.

## Verification

```bash
node scripts/performance-modernization-guard.mjs
node scripts/modernization-boundary-guard.mjs
npm run ui-source:guard
npm run typecheck
npm run build
```
