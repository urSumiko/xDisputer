# Modernization Canvas Next Actions Implementation

## Implemented actions

1. Dependency and server-state foundation
   - `src/features/app-providers/QueryProvider.tsx`
   - `src/features/admin/modernization-status-query.ts`
   - `app/layout.tsx`

2. Service-layer API route refactor
   - `src/server/contracts/template-assets-contract.ts`
   - `src/server/repositories/template-assets-repository.ts`
   - `src/server/services/template-assets-service.ts`
   - `app/api/template-assets/route.ts`

3. Client workspace split foundation
   - `src/features/client-workspace/components/ClientWorkspaceHeader.tsx`
   - `src/features/client-workspace/components/ClientWorkspaceNavigation.tsx`
   - `src/features/client-workspace/components/ClientWorkspaceBrand.tsx`

4. Lazy evidence stage wiring
   - `components/GuidedSourceDataFlow.tsx`
   - `src/features/evidence/components/LazyEvidenceStage.tsx`

5. CSS ownership and retirement guard
   - `scripts/css-ownership-guard.mjs`
   - `docs/css-retirement-map.md`
   - `scripts/modernization-canvas-next-actions-guard.mjs`
   - `package.json`

## Verification

Run the modernization guard, CSS ownership guard, UI source guard, typecheck, and build before using the preview.
