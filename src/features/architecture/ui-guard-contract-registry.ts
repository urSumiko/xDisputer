export const uiGuardContractRegistry = [
  {
    guard: 'scripts/console-shell-contract-guard.mjs',
    contract: 'src/features/account-rail/account-rail-contract.ts',
    rule: 'shell provides slots and account rail owns account actions'
  },
  {
    guard: 'scripts/notification-ui-frontend-guard.mjs',
    contract: 'src/features/notifications/notification-ownership-contract.ts',
    rule: 'notification dock ownership stays in account rail'
  },
  {
    guard: 'scripts/css-ownership-guard.mjs',
    contract: 'src/features/client-workspace/client-css-ownership.ts',
    rule: 'client CSS ownership must be driven by feature ownership registry'
  },
  {
    guard: 'scripts/backend-frontend-refactor-guard.mjs',
    contract: 'src/features/architecture/backend-frontend-refactor-contract.ts',
    rule: 'backend and frontend refactor priorities remain traceable'
  }
] as const;
