export const notificationUiContract = {
  owner: 'src/features/notifications',
  canvas: 'docs/notification-ui-fbis-canvas.md',
  service: 'lib/notifications/notification-service.ts',
  apiService: 'src/features/notifications/notification-api-service.ts',
  writeService: 'lib/notifications/notification-write-service.ts',
  dock: 'components/notifications/OwnedNotificationDock.tsx',
  shellOwner: 'components/console/AccountMenu.tsx',
  guard: 'scripts/notification-ui-schema-guard.mjs',
  behavior: {
    directAudience: 'recipient_user_id',
    roleAudience: 'recipient_role',
    schemaMode: 'strict-canonical-columns',
    popoverLayout: 'absolute-contained-no-content-push'
  }
} as const;
