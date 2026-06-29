import type { SessionContext } from './saas/session';

export type ManagerTemplateScope = {
  source: 'MANAGER_SELF' | 'ASSIGNED_MANAGER' | 'MASTER_SELF';
  requesterUserId: string;
  managerUserId: string;
  canManageTemplates: boolean;
  readOnlyForRequester: boolean;
  role: NonNullable<SessionContext['role']>;
};

export class ManagerTemplateScopeError extends Error {
  code: 'NO_AUTH' | 'NO_MANAGER_ASSIGNED' | 'CLIENT_TEMPLATE_UPLOAD_DISABLED';

  constructor(code: ManagerTemplateScopeError['code'], message: string) {
    super(message);
    this.name = 'ManagerTemplateScopeError';
    this.code = code;
  }
}

export const CLIENT_TEMPLATE_UPLOAD_DISABLED_MESSAGE = 'Template uploads are manager-controlled. Clients use the active templates uploaded by their assigned manager.';
export const MANAGER_TEMPLATE_MISSING_ASSIGNMENT_MESSAGE = 'Template manager is not assigned. Ask an admin or manager to assign this client before generating documents.';

export function canManageManagerTemplates(session: Pick<SessionContext, 'isMaster' | 'isManager' | 'role'>) {
  return Boolean(session.isMaster || session.isManager || session.role === 'admin' || session.role === 'manager' || session.role === 'master');
}

async function assignmentManagerFromTable(session: SessionContext) {
  if (!session.user) return null;

  const { data, error } = await session.supabase
    .from('manager_client_assignments')
    .select('manager_user_id')
    .eq('client_user_id', session.user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return typeof data?.manager_user_id === 'string' && data.manager_user_id ? data.manager_user_id : null;
}

export async function resolveManagerTemplateScope(session: SessionContext): Promise<ManagerTemplateScope> {
  if (!session.user || !session.role) {
    throw new ManagerTemplateScopeError('NO_AUTH', 'No authenticated user.');
  }

  if (canManageManagerTemplates(session)) {
    return {
      source: session.isMaster ? 'MASTER_SELF' : 'MANAGER_SELF',
      requesterUserId: session.user.id,
      managerUserId: session.user.id,
      canManageTemplates: true,
      readOnlyForRequester: false,
      role: session.role
    };
  }

  const profileManagerId = session.profile?.manager_id || null;
  const assignmentManagerId = profileManagerId || await assignmentManagerFromTable(session);

  if (!assignmentManagerId) {
    throw new ManagerTemplateScopeError('NO_MANAGER_ASSIGNED', MANAGER_TEMPLATE_MISSING_ASSIGNMENT_MESSAGE);
  }

  return {
    source: 'ASSIGNED_MANAGER',
    requesterUserId: session.user.id,
    managerUserId: assignmentManagerId,
    canManageTemplates: false,
    readOnlyForRequester: true,
    role: session.role
  };
}

export function assertCanManageManagerTemplates(scope: ManagerTemplateScope) {
  if (!scope.canManageTemplates) {
    throw new ManagerTemplateScopeError('CLIENT_TEMPLATE_UPLOAD_DISABLED', CLIENT_TEMPLATE_UPLOAD_DISABLED_MESSAGE);
  }
}

export function managerTemplateScopePayload(scope: ManagerTemplateScope) {
  return {
    templateScope: 'MANAGER_TEMPLATE_ASSET',
    managerUserId: scope.managerUserId,
    requesterUserId: scope.requesterUserId,
    source: scope.source,
    readOnlyForRequester: scope.readOnlyForRequester,
    canManageTemplates: scope.canManageTemplates
  };
}
