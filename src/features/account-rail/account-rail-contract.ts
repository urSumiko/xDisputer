export const accountRailContract = {
  owner: 'src/features/account-rail',
  shellSlotOwner: 'components/console/ConsoleShell.tsx',
  railComponentOwner: 'components/console/AccountMenu.tsx',
  notificationDockOwner: 'components/notifications/OwnedNotificationDock.tsx',
  ratio: '75/25 console header with right-side account rail',
  rule: 'Account rail owns notification dock, account avatar, and account popover. Console shell only provides the rail slot.'
} as const;

export const accountRailMarkers = {
  shell: 'data-console-header-grid="true"',
  rail: 'data-manager-account-anchor="header-ratio-grid"',
  dock: 'data-notification-dock="true"'
} as const;
