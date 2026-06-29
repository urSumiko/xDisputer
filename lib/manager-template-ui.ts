import { resolveTemplateAuthority } from './manager-template-authority';

export type ManagerTemplateScopeUi = {
  templateScope: 'MANAGER_TEMPLATE_ASSET';
  managerUserId: string;
  requesterUserId: string;
  source: 'MANAGER_SELF' | 'ASSIGNED_MANAGER' | 'MASTER_SELF';
  readOnlyForRequester: boolean;
  canManageTemplates: boolean;
};

export function managerTemplateAuthorityLabel(scope: ManagerTemplateScopeUi | null | undefined) {
  return resolveTemplateAuthority(scope).eyebrow;
}

export function managerTemplateActionLabel(scope: ManagerTemplateScopeUi | null | undefined) {
  return resolveTemplateAuthority(scope).actionLabel;
}

export function managerTemplateStatusLabel(scope: ManagerTemplateScopeUi | null | undefined) {
  return resolveTemplateAuthority(scope).statusBadge;
}

export function canUseLocalBrowserTemplateFallback(scope: ManagerTemplateScopeUi | null | undefined) {
  return Boolean(scope?.canManageTemplates);
}
