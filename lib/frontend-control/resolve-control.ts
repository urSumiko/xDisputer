import { getActionContract, type ActionId } from './action-registry';
import { getContent, type ContentKey } from './content-registry';
import { getIdentityContract, type ComponentIdentity } from './identity-registry';
import { getLayoutContract, type LayoutId } from './layout-registry';
import { getPerformanceProfile, type PerformanceProfileId } from './performance-profile';
import { findNavigationByHref, findNavigationById } from './navigation-map';

export type FrontendControlSnapshot = {
  identity: ReturnType<typeof getIdentityContract>;
  layout: ReturnType<typeof getLayoutContract>;
  performance: ReturnType<typeof getPerformanceProfile>;
  label?: string;
};

export function resolveFrontendControl(input: {
  identity: ComponentIdentity;
  layout: LayoutId;
  performance: PerformanceProfileId;
  labelKey?: ContentKey;
}): FrontendControlSnapshot {
  return {
    identity: getIdentityContract(input.identity),
    layout: getLayoutContract(input.layout),
    performance: getPerformanceProfile(input.performance),
    label: input.labelKey ? getContent(input.labelKey) : undefined
  };
}

export function resolveAction(id: ActionId) {
  return getActionContract(id);
}

export const frontendNavigation = {
  byHref: findNavigationByHref,
  byId: findNavigationById
};
