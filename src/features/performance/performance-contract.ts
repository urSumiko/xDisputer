export const performanceContract = {
  owner: 'src/features/performance',
  canvas: 'docs/performance-boost-canvas.md',
  guard: 'scripts/performance-boost-guard.mjs',
  debugMount: 'components/console/RenderDebuggerMount.tsx',
  notificationOwner: 'components/console/AccountMenu.tsx',
  dashboardOwner: 'components/DashboardOperationsWorkspace.tsx',
  outputBoundaryOwner: 'components/ClientOutputLimitBoundary.tsx',
  workspaceOwner: 'components/LetterGeneratorWorkspaceV2.tsx',
  rules: {
    debugPanelDefault: 'off',
    notificationOwner: 'account-rail-only',
    notificationPollingMs: 120000,
    dashboardEntitlementSurface: 'static-no-polling-chip',
    outputBoundaryRefresh: 'event-driven-no-interval',
    archiveBuilder: 'lazy-jszip-after-user-generation-action',
    supabaseQueryOrder: 'from-select-filter-order-limit',
    heavyClientLibraries: 'lazy-or-server-only',
    cssOwnership: 'feature-owned-or-contract-marked'
  }
} as const;

export const performanceCriticalGaps = [
  'debug-overlay-default-on',
  'browser-timer-frequency',
  'heavy-client-bundle-risk',
  'global-css-cascade-risk',
  'supabase-overfetch-or-query-order'
] as const;
