export const ACCOUNT_ROLES = ['master', 'manager', 'client'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const WORKSPACE_KINDS = ['master', 'manager', 'client'] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export type WorkspaceId = string;
export type AccountId = string;

export type PermissionAction =
  | 'read'
  | 'write'
  | 'manage'
  | 'simulate'
  | 'monitor'
  | 'report'
  | 'configure'
  | 'register_snapshot'
  | 'test_packet';

export type PermissionResource =
  | 'global_controls'
  | 'global_content_controls'
  | 'master_workspace'
  | 'manager_workspace'
  | 'client_workspace'
  | 'access_control'
  | 'monitoring'
  | 'reports'
  | 'generation_output'
  | 'generation_packet'
  | 'notifications'
  | 'layout_registry'
  | 'component_registry';

export type Permission = `${PermissionAction}:${PermissionResource}`;

export type WorkspaceSelectionMode = 'self' | 'manager_subject' | 'client_subject';

export type WorkspaceSubject = {
  readonly accountId: AccountId;
  readonly role: AccountRole;
  readonly workspaceKind: WorkspaceKind;
  readonly workspaceId?: WorkspaceId;
  readonly managerId?: AccountId;
};

export type AuthenticatedActor = {
  readonly accountId: AccountId;
  readonly email?: string;
  readonly role: AccountRole;
  readonly workspaceId?: WorkspaceId;
  readonly managerId?: AccountId;
};

export type WorkspaceContext = {
  readonly actor: AuthenticatedActor;
  readonly workspaceKind: WorkspaceKind;
  readonly selectionMode: WorkspaceSelectionMode;
  readonly selectedSubject?: WorkspaceSubject;
};

export type DesignTokenScope = 'global' | 'workspace' | 'role' | 'component';

export type DesignTokenValue = string | number;

export type DesignToken = {
  readonly name: string;
  readonly value: DesignTokenValue;
  readonly scope: DesignTokenScope;
  readonly description: string;
};

export type ComponentIdentity = {
  readonly id: string;
  readonly label: string;
  readonly workspaceKind?: WorkspaceKind;
  readonly ownerRole?: AccountRole;
  readonly propagationGroup: string;
  readonly requiredPermissions: readonly Permission[];
  readonly designTokens: readonly string[];
  readonly source?: string;
};

export type ComponentRegistryQuery = {
  readonly workspaceKind?: WorkspaceKind;
  readonly ownerRole?: AccountRole;
  readonly propagationGroup?: string;
  readonly permission?: Permission;
};

export type SystemEventName =
  | 'workspace.context.changed'
  | 'rbac.permission.denied'
  | 'design.tokens.changed'
  | 'component.registry.changed'
  | 'global.rule.propagated';

export type SystemEventPayloadMap = {
  readonly 'workspace.context.changed': {
    readonly previous?: WorkspaceContext;
    readonly next: WorkspaceContext;
  };
  readonly 'rbac.permission.denied': {
    readonly actor: AuthenticatedActor;
    readonly permission: Permission;
    readonly reason: string;
  };
  readonly 'design.tokens.changed': {
    readonly scope: DesignTokenScope;
    readonly tokenNames: readonly string[];
  };
  readonly 'component.registry.changed': {
    readonly componentId: string;
    readonly operation: 'registered' | 'replaced' | 'removed';
  };
  readonly 'global.rule.propagated': {
    readonly source: 'global' | 'workspace' | 'role' | 'component';
    readonly propagationGroup: string;
    readonly affectedComponentIds: readonly string[];
  };
};

export type SystemEventPayload<TName extends SystemEventName> = SystemEventPayloadMap[TName];

export type SystemCoreSnapshot = {
  readonly workspace: WorkspaceContext;
  readonly permissions: readonly Permission[];
  readonly designTokens: readonly DesignToken[];
  readonly components: readonly ComponentIdentity[];
};
