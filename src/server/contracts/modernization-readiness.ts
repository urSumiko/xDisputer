export type ModernizationReadinessStatus = 'phase-1-coded' | 'phase-2-foundation-coded';

export type ModernizationReadiness = {
  layer: 'modernization-boundary';
  status: ModernizationReadinessStatus;
  coded: readonly string[];
  deferred: readonly string[];
  nextAction: string;
};

export const modernizationCodedFiles = [
  'docs/modernization-implementation-tracker.md',
  'docs/modernization-boundary-contract.md',
  'src/features/README.md',
  'src/server/README.md',
  'src/server/contracts/service-result.ts',
  'src/server/contracts/modernization-readiness.ts',
  'src/server/services/modernization-readiness-service.ts',
  'src/server/http/api-response.ts',
  'scripts/modernization-boundary-guard.mjs',
  'scripts/modernization-dependency-sync.mjs'
] as const;

export const modernizationDeferredItems = [
  'Tailwind v4 package installation',
  'shadcn/ui primitives',
  'full src/app migration',
  'root CSS reduction',
  'large component split',
  'complete API route service refactor'
] as const;
