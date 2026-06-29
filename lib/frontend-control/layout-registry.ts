import type { ComponentIdentity } from './identity-registry';

export type LayoutId =
  | 'public.simple'
  | 'portal.dashboard'
  | 'workspace.grid'
  | 'workspace.split'
  | 'workspace.review';

export type LayoutContract = {
  id: LayoutId;
  shell: 'public' | 'portal' | 'master' | 'manager' | 'client';
  density: 'compact' | 'comfortable' | 'spacious';
  regions: readonly string[];
  defaultIdentities: readonly ComponentIdentity[];
};

export const layoutRegistry: Record<LayoutId, LayoutContract> = {
  'public.simple': {
    id: 'public.simple',
    shell: 'public',
    density: 'comfortable',
    regions: ['header', 'main', 'footer'],
    defaultIdentities: ['action.primary', 'action.secondary', 'empty.state']
  },
  'portal.dashboard': {
    id: 'portal.dashboard',
    shell: 'portal',
    density: 'comfortable',
    regions: ['topbar', 'sidebar', 'main', 'notificationRail'],
    defaultIdentities: ['workspace.frame', 'metric.card', 'notification.item']
  },
  'workspace.grid': {
    id: 'workspace.grid',
    shell: 'master',
    density: 'comfortable',
    regions: ['summary', 'primaryGrid', 'secondaryGrid'],
    defaultIdentities: ['workspace.frame', 'metric.card', 'table.directory']
  },
  'workspace.split': {
    id: 'workspace.split',
    shell: 'manager',
    density: 'compact',
    regions: ['leftPanel', 'rightPanel', 'actionBar'],
    defaultIdentities: ['workspace.frame', 'panel.template', 'action.primary']
  },
  'workspace.review': {
    id: 'workspace.review',
    shell: 'client',
    density: 'comfortable',
    regions: ['summary', 'documentPreview', 'actionBar'],
    defaultIdentities: ['workspace.frame', 'panel.audit', 'action.primary']
  }
} as const;

export function getLayoutContract(id: LayoutId): LayoutContract {
  return layoutRegistry[id];
}
