import type {
  AuthenticatedActor,
  WorkspaceContext,
  WorkspaceKind,
  WorkspaceSelectionMode,
  WorkspaceSubject
} from './types';
import { canManageSubject, canOpenWorkspace, type PermissionDecision } from './rbac';

export type WorkspaceContextInput = {
  readonly actor: AuthenticatedActor;
  readonly requestedWorkspaceKind?: WorkspaceKind;
  readonly selectionMode?: WorkspaceSelectionMode;
  readonly selectedSubject?: WorkspaceSubject;
};

export function getDefaultWorkspaceKind(role: AuthenticatedActor['role']): WorkspaceKind {
  if (role === 'master') return 'master';
  if (role === 'manager') return 'manager';
  return 'client';
}

export function createWorkspaceContext(input: WorkspaceContextInput): WorkspaceContext {
  const workspaceKind = input.requestedWorkspaceKind ?? getDefaultWorkspaceKind(input.actor.role);
  const selectionMode = input.selectionMode ?? 'self';

  return {
    actor: input.actor,
    workspaceKind,
    selectionMode,
    selectedSubject: input.selectedSubject
  };
}

export function validateWorkspaceContext(context: WorkspaceContext): PermissionDecision {
  const workspaceDecision = canOpenWorkspace(context);

  if (!workspaceDecision.allowed) {
    return workspaceDecision;
  }

  return canManageSubject(context);
}

export function resolveWorkspaceTitle(context: WorkspaceContext): string {
  if (context.actor.role === 'master' && context.selectionMode !== 'self' && context.selectedSubject) {
    return `Master Console / ${context.selectedSubject.role.toUpperCase()} Selection`;
  }

  if (context.workspaceKind === 'master') return 'Master Workspace';
  if (context.workspaceKind === 'manager') return 'Manager Workspace';
  return 'Client Workspace';
}

export function resolveWorkspaceBoundary(context: WorkspaceContext): string {
  const subject = context.selectedSubject;

  if (!subject) {
    return `${context.actor.role}:${context.workspaceKind}:self`;
  }

  return `${context.actor.role}:${context.workspaceKind}:${context.selectionMode}:${subject.role}:${subject.accountId}`;
}
