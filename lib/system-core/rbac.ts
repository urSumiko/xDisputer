import type {
  AccountRole,
  AuthenticatedActor,
  Permission,
  PermissionAction,
  PermissionResource,
  WorkspaceContext
} from './types';

export const ALL_PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'read',
  'write',
  'manage',
  'simulate',
  'monitor',
  'report',
  'configure',
  'register_snapshot',
  'test_packet'
] as const;

export const ALL_PERMISSION_RESOURCES: readonly PermissionResource[] = [
  'global_controls',
  'global_content_controls',
  'master_workspace',
  'manager_workspace',
  'client_workspace',
  'access_control',
  'monitoring',
  'reports',
  'generation_output',
  'generation_packet',
  'notifications',
  'layout_registry',
  'component_registry'
] as const;

function permission(action: PermissionAction, resource: PermissionResource): Permission {
  return `${action}:${resource}`;
}

function buildAllPermissions(): readonly Permission[] {
  return ALL_PERMISSION_ACTIONS.flatMap((action) =>
    ALL_PERMISSION_RESOURCES.map((resource) => permission(action, resource))
  );
}

const MASTER_PERMISSIONS = buildAllPermissions();

const MANAGER_PERMISSIONS: readonly Permission[] = [
  permission('read', 'manager_workspace'),
  permission('write', 'manager_workspace'),
  permission('manage', 'manager_workspace'),
  permission('read', 'client_workspace'),
  permission('manage', 'client_workspace'),
  permission('read', 'access_control'),
  permission('write', 'access_control'),
  permission('manage', 'access_control'),
  permission('read', 'monitoring'),
  permission('monitor', 'monitoring'),
  permission('read', 'reports'),
  permission('report', 'reports'),
  permission('read', 'generation_output'),
  permission('write', 'generation_output'),
  permission('register_snapshot', 'generation_output'),
  permission('read', 'generation_packet'),
  permission('test_packet', 'generation_packet'),
  permission('simulate', 'generation_packet'),
  permission('read', 'notifications'),
  permission('read', 'layout_registry'),
  permission('read', 'component_registry')
] as const;

const CLIENT_PERMISSIONS: readonly Permission[] = [
  permission('read', 'client_workspace'),
  permission('read', 'generation_output'),
  permission('read', 'notifications'),
  permission('read', 'reports')
] as const;

export const ROLE_PERMISSION_MATRIX: Readonly<Record<AccountRole, readonly Permission[]>> = {
  master: MASTER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  client: CLIENT_PERMISSIONS
};

export type PermissionDecision = {
  readonly allowed: boolean;
  readonly reason: string;
};

export function getPermissionsForRole(role: AccountRole): readonly Permission[] {
  return ROLE_PERMISSION_MATRIX[role];
}

export function hasPermission(actor: Pick<AuthenticatedActor, 'role'>, required: Permission): boolean {
  return ROLE_PERMISSION_MATRIX[actor.role].includes(required);
}

export function assertPermission(actor: AuthenticatedActor, required: Permission): PermissionDecision {
  if (hasPermission(actor, required)) {
    return { allowed: true, reason: 'permission-granted' };
  }

  return {
    allowed: false,
    reason: `${actor.role} cannot perform ${required}`
  };
}

export function canOpenWorkspace(context: WorkspaceContext): PermissionDecision {
  const required = permission('read', `${context.workspaceKind}_workspace`);
  const roleDecision = assertPermission(context.actor, required);

  if (!roleDecision.allowed) {
    return roleDecision;
  }

  if (context.actor.role === 'client' && context.workspaceKind !== 'client') {
    return { allowed: false, reason: 'client accounts can only open client workspace' };
  }

  if (context.actor.role === 'manager' && context.workspaceKind === 'master') {
    return { allowed: false, reason: 'manager accounts cannot open master workspace' };
  }

  if (context.selectionMode !== 'self' && context.actor.role !== 'master') {
    return { allowed: false, reason: 'selection mode is reserved for master accounts' };
  }

  return { allowed: true, reason: 'workspace-open-granted' };
}

export function canManageSubject(context: WorkspaceContext): PermissionDecision {
  if (!context.selectedSubject) {
    return { allowed: true, reason: 'no-subject-selected' };
  }

  if (context.actor.role === 'master') {
    return { allowed: true, reason: 'master-subject-control-granted' };
  }

  if (
    context.actor.role === 'manager' &&
    context.selectedSubject.role === 'client' &&
    context.selectedSubject.managerId === context.actor.accountId
  ) {
    return { allowed: true, reason: 'manager-owned-client-control-granted' };
  }

  return { allowed: false, reason: 'subject is outside actor control boundary' };
}
