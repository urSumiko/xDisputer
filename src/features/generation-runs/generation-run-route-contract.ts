export const generationRunRouteContract = {
  owner: 'src/features/generation-runs',
  currentRoute: 'app/api/generation-runs/route.ts',
  splitTargets: [
    'generation-run-request-parser.ts',
    'generation-run-entitlement-gate.ts',
    'generation-run-repository.ts',
    'generation-run-output-activity.ts',
    'generation-run-response-presenter.ts'
  ],
  invariants: [
    'route remains thin and delegates business logic',
    'entitlement gate runs before persistence for non-failed generation statuses',
    'manager output activity uses outputActivityContract',
    'integrity and observability stay feature-visible'
  ]
} as const;
