export const consoleShellContract = {
  owner: 'src/features/console-shell',
  component: 'components/console/ConsoleShell.tsx',
  responsibility: 'Provides sidebar, mode switch, header grid slot, and main content slot only.',
  forbiddenResponsibilities: [
    'business workflow decisions',
    'database queries',
    'notification data fetching',
    'account settings form state'
  ],
  layoutRatio: '75/25',
  headerGridMarker: 'data-console-header-grid="true"'
} as const;
