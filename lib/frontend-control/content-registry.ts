export type ContentKey =
  | 'global.loading'
  | 'global.retry'
  | 'dashboard.empty'
  | 'templates.empty'
  | 'notifications.empty'
  | 'actions.save'
  | 'actions.cancel'
  | 'actions.finalize'
  | 'actions.upload'
  | 'actions.refresh';

export const contentRegistry: Record<ContentKey, string> = {
  'global.loading': 'Preparing your workspace...',
  'global.retry': 'Review the issue and try again.',
  'dashboard.empty': 'No workspace activity yet.',
  'templates.empty': 'No templates are configured for this workspace.',
  'notifications.empty': 'No notifications yet.',
  'actions.save': 'Save',
  'actions.cancel': 'Cancel',
  'actions.finalize': 'Finalize',
  'actions.upload': 'Upload',
  'actions.refresh': 'Refresh'
} as const;

export function getContent(key: ContentKey): string {
  return contentRegistry[key];
}
