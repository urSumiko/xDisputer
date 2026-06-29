export type RefactorProblem = {
  id: string;
  layer: 'backend' | 'frontend';
  title: string;
  owner: string;
  affectedFiles: string[];
  goal: string;
};

export const backendRefactorProblems: RefactorProblem[] = [
  {
    id: 'B1',
    layer: 'backend',
    title: 'Generation route service split',
    owner: 'src/features/generation-runs',
    affectedFiles: [
      'app/api/generation-runs/route.ts',
      'lib/saas/access-entitlement.ts',
      'lib/saas/integrity-ledger.ts',
      'lib/notifications/notification-write-service.ts'
    ],
    goal: 'Move generation route business logic behind feature-owned services.'
  },
  {
    id: 'B2',
    layer: 'backend',
    title: 'Manager payroll settings service',
    owner: 'src/features/manager-console/payroll-settings-service.ts',
    affectedFiles: [
      'app/api/manager-console/payroll/route.ts',
      'lib/saas/manager-user-settings.ts'
    ],
    goal: 'Keep payroll normalization and persistence out of the route.'
  },
  {
    id: 'B3',
    layer: 'backend',
    title: 'Account profile revalidation registry',
    owner: 'src/features/account-profile/account-profile-revalidation.ts',
    affectedFiles: [
      'app/api/account/profile/route.ts'
    ],
    goal: 'Centralize revalidation paths for account profile updates.'
  },
  {
    id: 'B4',
    layer: 'backend',
    title: 'Backend placement rule',
    owner: 'src/features/architecture/backend-frontend-refactor-contract.ts',
    affectedFiles: [
      'app/api',
      'lib/saas',
      'src/features'
    ],
    goal: 'Use app/api for thin routes, src/features for business logic, and lib for shared infrastructure only.'
  },
  {
    id: 'B5',
    layer: 'backend',
    title: 'Feature-to-SQL traceability',
    owner: 'docs/roadmaps/backend-frontend-refactor-canvas.md',
    affectedFiles: [
      'supabase/migrations',
      'src/features/notifications',
      'src/features/manager-output-activity'
    ],
    goal: 'Track SQL dependencies and schema reload requirements per feature.'
  }
];

export const frontendRefactorProblems: RefactorProblem[] = [
  {
    id: 'F1',
    layer: 'frontend',
    title: 'Root CSS ownership reduction',
    owner: 'src/features/app-shell',
    affectedFiles: [
      'app/layout.tsx',
      'app/root-css-console-shell.css',
      'app/root-css-contracts.css'
    ],
    goal: 'Keep only true global contracts in root bundles.'
  },
  {
    id: 'F2',
    layer: 'frontend',
    title: 'Admin page presenters',
    owner: 'src/features/manager-console/admin-page-presenters.ts',
    affectedFiles: [
      'app/admin/page.tsx'
    ],
    goal: 'Move formatting and presentation helpers out of the page file.'
  },
  {
    id: 'F3',
    layer: 'frontend',
    title: 'Shell vs feature placement rule',
    owner: 'src/features/architecture/backend-frontend-refactor-contract.ts',
    affectedFiles: [
      'components',
      'src/features'
    ],
    goal: 'Keep shell/shared primitives in components and feature-owned UI in src/features.'
  },
  {
    id: 'F4',
    layer: 'frontend',
    title: 'Figma-ready surface handoff map',
    owner: 'docs/roadmaps/backend-frontend-refactor-canvas.md',
    affectedFiles: [
      'components/console',
      'src/features/client-workspace',
      'src/features/notifications'
    ],
    goal: 'Map shell slots, data owners, CSS owners, and guards per surface.'
  },
  {
    id: 'F5',
    layer: 'frontend',
    title: 'Guard inputs should come from contracts',
    owner: 'src/features/architecture/backend-frontend-refactor-contract.ts',
    affectedFiles: [
      'scripts',
      'src/features/account-rail',
      'src/features/client-workspace'
    ],
    goal: 'Reduce fragile string-based guard drift by reading feature registries.'
  }
];

export const backendFrontendRefactorContract = {
  canvas: 'docs/roadmaps/backend-frontend-refactor-canvas.md',
  backendCount: backendRefactorProblems.length,
  frontendCount: frontendRefactorProblems.length,
  rule: {
    backend: 'app/api = thin route, src/features = business service, lib = infrastructure/helper only',
    frontend: 'components = shell/shared primitives, src/features = feature-owned UI, presenters, CSS contracts, and services'
  }
} as const;
