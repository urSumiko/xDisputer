import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getSessionContext } from './session';
import {
  normalizeAccountStatus,
  normalizeRole,
  type AccountStatus,
  type UserProfile
} from '../supabase/roles';

export type AccessEntitlementReason =
  | 'ALLOWED'
  | 'NO_USER'
  | 'NO_PROFILE'
  | 'NO_MANAGER'
  | 'PENDING_MANAGER_APPROVAL'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DISABLED'
  | 'MANAGER_INACTIVE';

export type AccessEntitlement = {
  allowed: boolean;
  reason: AccessEntitlementReason;
  title: string;
  detail: string;
  actionLabel: string;
  managerEmail?: string | null;
  status?: AccountStatus;
};

function blocked(
  reason: AccessEntitlementReason,
  title: string,
  detail: string,
  actionLabel = 'Return later'
): AccessEntitlement {
  return { allowed: false, reason, title, detail, actionLabel };
}

function activeStatus(profile: UserProfile | null | undefined) {
  return normalizeAccountStatus(profile?.account_status, profile?.role);
}

export async function getAccessEntitlement(): Promise<AccessEntitlement> {
  const session = await getSessionContext();

  if (!session.user) {
    return blocked('NO_USER', 'Sign in required', 'Sign in before accessing the protected workspace.', 'Sign in');
  }

  if (!session.profile) {
    return blocked('NO_PROFILE', 'Profile is not ready', 'Your account profile could not be prepared yet.', 'Try again');
  }

  const role = normalizeRole(session.role);
  const status = activeStatus(session.profile);

  if (role === 'master' || role === 'manager') {
    if (status === 'disabled') {
      return blocked('ACCOUNT_DISABLED', 'Account unavailable', 'This account is disabled.', 'Contact support');
    }

    if (status === 'suspended') {
      return blocked('ACCOUNT_SUSPENDED', 'Account suspended', 'This account is temporarily suspended.', 'Contact support');
    }

    return {
      allowed: true,
      reason: 'ALLOWED',
      title: 'Access allowed',
      detail: 'Manager or master account is active.',
      actionLabel: 'Continue',
      status
    };
  }

  if (status === 'disabled') {
    return blocked(
      'ACCOUNT_DISABLED',
      'Account unavailable',
      'Your account is disabled. Contact your manager for access.',
      'Contact manager'
    );
  }

  if (status === 'suspended') {
    return blocked(
      'ACCOUNT_SUSPENDED',
      'Account suspended',
      'Your account is temporarily unavailable. Contact your manager.',
      'Contact manager'
    );
  }

  if (!session.profile.manager_id) {
    return blocked(
      'NO_MANAGER',
      'Waiting for manager invite',
      'Your account was created, but it is not connected to a manager yet. Ask your manager to send you an invite link.',
      'Wait for manager invite'
    );
  }

  if (status === 'pending_manager_approval') {
    const { data: manager } = await session.supabase
      .from('profiles')
      .select('email, account_status')
      .eq('id', session.profile.manager_id)
      .maybeSingle();

    return {
      allowed: false,
      reason: 'PENDING_MANAGER_APPROVAL',
      title: 'Waiting for manager approval',
      detail: 'Your account is connected to a manager, but the manager has not approved workspace access yet.',
      actionLabel: 'Wait for approval',
      managerEmail: manager?.email || null,
      status
    };
  }

  if (status !== 'active') {
    return blocked(
      'PENDING_MANAGER_APPROVAL',
      'Waiting for approval',
      'Your account is not active yet. Your manager must approve access before you can use the workspace.',
      'Wait for approval'
    );
  }

  const { data: manager } = await session.supabase
    .from('profiles')
    .select('email, role, account_status')
    .eq('id', session.profile.manager_id)
    .maybeSingle();

  const managerRole = normalizeRole(manager?.role);
  const managerStatus = normalizeAccountStatus(manager?.account_status, managerRole);

  if (!manager || (managerRole !== 'manager' && managerRole !== 'master') || managerStatus !== 'active') {
    return {
      allowed: false,
      reason: 'MANAGER_INACTIVE',
      title: 'Manager approval unavailable',
      detail: 'Your manager account is not currently active. Contact your manager or platform owner.',
      actionLabel: 'Contact manager',
      managerEmail: manager?.email || null,
      status
    };
  }

  return {
    allowed: true,
    reason: 'ALLOWED',
    title: 'Workspace unlocked',
    detail: 'Your account is active and approved by your manager.',
    actionLabel: 'Continue',
    managerEmail: manager.email,
    status
  };
}

export async function requireWorkspaceAccess() {
  const entitlement = await getAccessEntitlement();

  if (!entitlement.allowed) {
    redirect('/account-pending');
  }

  return entitlement;
}

export async function workspaceAccessErrorResponse() {
  const entitlement = await getAccessEntitlement();

  if (entitlement.allowed) return null;

  return NextResponse.json(
    {
      error: entitlement.title,
      message: entitlement.detail,
      reason: entitlement.reason
    },
    { status: entitlement.reason === 'NO_USER' ? 401 : 403 }
  );
}
