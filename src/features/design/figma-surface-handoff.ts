export type SurfaceHandoff = {
  surface: string;
  slotOwner: string;
  dataOwner: string;
  cssOwner: string;
  guardOwner: string;
};

export const figmaSurfaceHandoff: SurfaceHandoff[] = [
  {
    surface: 'manager-console',
    slotOwner: 'components/ManagerConsoleShell.tsx',
    dataOwner: 'app/admin/page.tsx',
    cssOwner: 'app/manager-console-workflow.css',
    guardOwner: 'scripts/manager-console-workflow-guard.mjs'
  },
  {
    surface: 'account-rail',
    slotOwner: 'components/console/ConsoleShell.tsx',
    dataOwner: 'components/console/AccountMenu.tsx',
    cssOwner: 'app/account-menu-ratio-system.css',
    guardOwner: 'scripts/console-shell-contract-guard.mjs'
  },
  {
    surface: 'notification-dock',
    slotOwner: 'components/console/AccountMenu.tsx',
    dataOwner: 'src/features/notifications/notification-api-service.ts',
    cssOwner: 'app/notification-account-rail.css',
    guardOwner: 'scripts/notification-ui-frontend-guard.mjs'
  },
  {
    surface: 'client-workspace',
    slotOwner: 'components/LetterGeneratorWorkspaceV2.tsx',
    dataOwner: 'app/workspace/page.tsx',
    cssOwner: 'app/client-workspace-layout-lock.css',
    guardOwner: 'scripts/client-critical-gaps-guard.mjs'
  }
];
