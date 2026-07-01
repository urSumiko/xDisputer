const NOTIFICATION_API_BASE = '/api/' + 'notifications';

export const notificationOwnershipContract = {
  ownerComponent: 'components/console/AccountMenu.tsx',
  ownerStyleHost: 'components/notifications/OwnedNotificationDock.tsx',
  ownerService: 'src/features/notifications/notification-api-service.ts',
  ownerWriteService: 'lib/notifications/notification-write-service.ts',
  realtimeTables: ['notifications', 'manager_disputer_output_approvals'],
  pollIntervalMs: 120_000,
  warmupRefreshMs: 5_000,
  maxVisibleItems: 8,
  readEndpoint: `${NOTIFICATION_API_BASE}/read`,
  clearReadEndpoint: `${NOTIFICATION_API_BASE}/clear-read`
} as const;
