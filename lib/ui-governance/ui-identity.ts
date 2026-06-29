export type UiIdentityScope = 'global' | 'client' | 'manager' | 'master';
export type UiIdentityKind = 'route' | 'region' | 'component' | 'property' | 'behavior' | 'layout' | 'content';

export type UiIdentity = {
  id: string;
  kind: UiIdentityKind;
  scope: UiIdentityScope;
  label: string;
  description: string;
  locked?: boolean;
};

export const GLOBAL_UI_IDENTITIES: UiIdentity[] = [
  { id: 'global.topbar.actions', kind: 'region', scope: 'global', label: 'Global topbar actions', description: 'Shared notification and account menu area.' },
  { id: 'master.console.switch', kind: 'behavior', scope: 'master', label: 'Master Console UI Workspace switch', description: 'Master route switch between console and UI workspace.' },
  { id: 'workspace.content.copy', kind: 'content', scope: 'global', label: 'Workspace content copy', description: 'Shared title, helper, and empty-state copy.' },
  { id: 'workspace.layout.density', kind: 'layout', scope: 'global', label: 'Workspace layout density', description: 'Shared spacing and compactness settings.' }
];

export function findUiIdentity(id: string) {
  return GLOBAL_UI_IDENTITIES.find((identity) => identity.id === id) || null;
}
