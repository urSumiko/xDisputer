import type { AccountScope } from './account-scope';
import type { LayoutId } from './layout-registry';

export type NavigationEntry = {
  id: string;
  href: string;
  label: string;
  scopes: readonly AccountScope[];
  layout: LayoutId;
  group: string;
  loading: 'instant' | 'skeleton' | 'streamed';
};

export const navigationMap: readonly NavigationEntry[] = [
  { id: 'public.home', href: '/', label: 'Home', scopes: ['public'], layout: 'public.simple', group: 'public', loading: 'instant' },
  { id: 'master.dashboard', href: '/master', label: 'Master Dashboard', scopes: ['master'], layout: 'workspace.grid', group: 'master', loading: 'streamed' },
  { id: 'manager.dashboard', href: '/manager', label: 'Manager Dashboard', scopes: ['manager'], layout: 'workspace.split', group: 'manager', loading: 'streamed' },
  { id: 'client.dashboard', href: '/client', label: 'Client Dashboard', scopes: ['client'], layout: 'workspace.review', group: 'client', loading: 'skeleton' }
] as const;

export function findNavigationByHref(href: string): NavigationEntry | undefined {
  return navigationMap.find((entry) => entry.href === href);
}

export function findNavigationById(id: string): NavigationEntry | undefined {
  return navigationMap.find((entry) => entry.id === id);
}
