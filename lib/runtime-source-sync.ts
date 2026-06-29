export const XDISPUTER_RUNTIME_SYNC = {
  marker: 'xdisputer-runtime-20260624-manager-output-sync-v1',
  terminologyContract: 'platform-client-role-displays-as-disputer-letter-subject-stays-client',
  stickyHeaderProfile: 'zero-lag-border-only',
  expectedPullBranch: 'main',
  changedAreas: [
    'manager-console-live-entitlement-refresh',
    'manager-console-actions-before-status',
    'daily-output-entitlement-sync-v2',
    'template-library-round-only-ui',
    'template-studio-collapsed-advanced-analysis'
  ],
  verifyPaths: [
    'components/manager/ManagerConsoleRealtimeRefreshMount.tsx',
    'app/admin/page.tsx',
    'components/console/AutoRouteRefresh.tsx',
    'supabase/migrations/20260624021000_manager_console_daily_output_sync_v2.sql',
    'components/templates/workspace/TemplateRoundOnlyLibrary.tsx',
    'components/templates/workspace/TemplateStudioHub.tsx'
  ]
} as const;
