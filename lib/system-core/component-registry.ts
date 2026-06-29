import type { ComponentIdentity, ComponentRegistryQuery } from './types';

export const CANVAS_0_COMPONENT_IDENTITIES: readonly ComponentIdentity[] = [
  {
    id: 'global-controls-kernel',
    label: 'Global Controls Kernel',
    ownerRole: 'master',
    propagationGroup: 'global-core',
    requiredPermissions: ['configure:global_controls', 'manage:component_registry'],
    designTokens: ['--xds-shell-gap'],
    source: 'lib/system-core/global-core.ts'
  },
  {
    id: 'master-workspace-control-plane',
    label: 'Master Workspace Control Plane',
    workspaceKind: 'master',
    ownerRole: 'master',
    propagationGroup: 'workspace-shells',
    requiredPermissions: ['read:master_workspace', 'configure:global_controls'],
    designTokens: ['--xds-master-accent', '--xds-shell-sidebar-width'],
    source: 'future:app/master/*'
  },
  {
    id: 'manager-workspace-execution-plane',
    label: 'Manager Workspace Execution Plane',
    workspaceKind: 'manager',
    ownerRole: 'manager',
    propagationGroup: 'workspace-shells',
    requiredPermissions: ['read:manager_workspace', 'manage:client_workspace'],
    designTokens: ['--xds-manager-accent', '--xds-shell-sidebar-width'],
    source: 'future:app/manager-workspace/*'
  },
  {
    id: 'client-workspace-experience-plane',
    label: 'Client Workspace Experience Plane',
    workspaceKind: 'client',
    ownerRole: 'client',
    propagationGroup: 'workspace-shells',
    requiredPermissions: ['read:client_workspace', 'read:notifications'],
    designTokens: ['--xds-client-accent', '--xds-notification-anchor-size'],
    source: 'future:app/workspace/*'
  }
] as const;

export class ComponentIdentityRegistry {
  private readonly components = new Map<string, ComponentIdentity>();

  constructor(seedComponents: readonly ComponentIdentity[] = CANVAS_0_COMPONENT_IDENTITIES) {
    for (const component of seedComponents) {
      this.components.set(component.id, component);
    }
  }

  list(query: ComponentRegistryQuery = {}): readonly ComponentIdentity[] {
    return Array.from(this.components.values()).filter((component) => {
      if (query.workspaceKind && component.workspaceKind !== query.workspaceKind) return false;
      if (query.ownerRole && component.ownerRole !== query.ownerRole) return false;
      if (query.propagationGroup && component.propagationGroup !== query.propagationGroup) return false;
      if (query.permission && !component.requiredPermissions.includes(query.permission)) return false;
      return true;
    });
  }

  get(componentId: string): ComponentIdentity | undefined {
    return this.components.get(componentId);
  }

  register(component: ComponentIdentity): 'registered' | 'replaced' {
    const operation = this.components.has(component.id) ? 'replaced' : 'registered';
    this.components.set(component.id, component);
    return operation;
  }

  remove(componentId: string): boolean {
    return this.components.delete(componentId);
  }

  require(componentId: string): ComponentIdentity {
    const component = this.get(componentId);

    if (!component) {
      throw new Error(`Missing component identity: ${componentId}`);
    }

    return component;
  }
}

export function createComponentIdentityRegistry(
  seedComponents?: readonly ComponentIdentity[]
): ComponentIdentityRegistry {
  return new ComponentIdentityRegistry(seedComponents);
}
