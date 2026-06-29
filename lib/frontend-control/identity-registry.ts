import type { ActionId } from './action-registry';

export type ComponentIdentity =
  | 'action.primary'
  | 'action.secondary'
  | 'table.directory'
  | 'panel.audit'
  | 'panel.template'
  | 'empty.state'
  | 'metric.card'
  | 'notification.item'
  | 'workspace.frame';

export type IdentityContract = {
  id: ComponentIdentity;
  family: 'action' | 'table' | 'panel' | 'state' | 'metric' | 'notification' | 'workspace';
  variants: readonly string[];
  actions: readonly ActionId[];
  tokenGroup: string;
};

export const identityRegistry: Record<ComponentIdentity, IdentityContract> = {
  'action.primary': {
    id: 'action.primary',
    family: 'action',
    variants: ['default', 'success', 'warning'],
    actions: ['click.feedback', 'pending.guard', 'notice.inline'],
    tokenGroup: 'commandButton.primary'
  },
  'action.secondary': {
    id: 'action.secondary',
    family: 'action',
    variants: ['default', 'ghost'],
    actions: ['click.feedback', 'notice.inline'],
    tokenGroup: 'commandButton.secondary'
  },
  'table.directory': {
    id: 'table.directory',
    family: 'table',
    variants: ['default', 'compact'],
    actions: ['search.local', 'sort.local', 'page.server'],
    tokenGroup: 'table.directory'
  },
  'panel.audit': {
    id: 'panel.audit',
    family: 'panel',
    variants: ['default'],
    actions: ['refresh.manual', 'notice.inline'],
    tokenGroup: 'panel.standard'
  },
  'panel.template': {
    id: 'panel.template',
    family: 'panel',
    variants: ['default', 'managerOwned'],
    actions: ['upload.pending', 'validate.beforeSave', 'notice.inline'],
    tokenGroup: 'panel.standard'
  },
  'empty.state': {
    id: 'empty.state',
    family: 'state',
    variants: ['info', 'warning'],
    actions: ['notice.inline'],
    tokenGroup: 'emptyState.standard'
  },
  'metric.card': {
    id: 'metric.card',
    family: 'metric',
    variants: ['default', 'success', 'warning'],
    actions: ['notice.inline'],
    tokenGroup: 'metric.card'
  },
  'notification.item': {
    id: 'notification.item',
    family: 'notification',
    variants: ['info', 'success', 'warning'],
    actions: ['mark.read', 'navigate.href'],
    tokenGroup: 'notification.item'
  },
  'workspace.frame': {
    id: 'workspace.frame',
    family: 'workspace',
    variants: ['master', 'manager', 'client'],
    actions: ['refresh.manual', 'notice.inline'],
    tokenGroup: 'workspace.frame'
  }
} as const;

export function getIdentityContract(id: ComponentIdentity): IdentityContract {
  return identityRegistry[id];
}
