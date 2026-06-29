import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './server';
import { dashboardForRole } from '../saas/routes';

export type UserRole = 'master' | 'manager' | 'admin' | 'client';

export type AccountStatus =
  | 'pending_manager_assignment'
  | 'pending_manager_approval'
  | 'active'
  | 'suspended'
  | 'disabled';

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  account_status: AccountStatus | null;
  manager_id: string | null;
  manager_invite_code: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const bootstrapMasterEmails = new Set(['mycoquibuyen2002@gmail.com']);

export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === 'admin') return 'manager';
  if (role === 'master' || role === 'manager' || role === 'client') return role;
  return 'client';
}

export function roleForEmail(email: string | null | undefined): UserRole {
  const normalizedEmail = email?.toLowerCase();
  return normalizedEmail && bootstrapMasterEmails.has(normalizedEmail) ? 'master' : 'client';
}

export function normalizeAccountStatus(status: string | null | undefined, role?: UserRole | null): AccountStatus {
  const resolvedRole = normalizeRole(role);

  if (resolvedRole === 'master' || resolvedRole === 'manager') {
    return status === 'disabled' || status === 'suspended' ? status : 'active';
  }

  if (
    status === 'pending_manager_assignment' ||
    status === 'pending_manager_approval' ||
    status === 'active' ||
    status === 'suspended' ||
    status === 'disabled'
  ) {
    return status;
  }

  if (status === 'paused') return 'suspended';

  return 'pending_manager_assignment';
}

export function accountStatus(profile: UserProfile | null | undefined): AccountStatus {
  return normalizeAccountStatus(profile?.account_status, profile?.role);
}

export function canAccessRole(currentRole: UserRole | null | undefined, requiredRole: UserRole) {
  const current = normalizeRole(currentRole);
  const required = normalizeRole(requiredRole);
  return current === required;
}

function metadataString(user: { user_metadata?: Record<string, unknown> }, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveInviteManagerId(
  supabase: SupabaseServerClient,
  inviteCode: string
) {
  if (!inviteCode) return null;

  const { data } = await supabase.rpc('access_resolve_manager_invite', {
    invite_code_input: inviteCode
  });

  return typeof data === 'string' && data ? data : null;
}

export async function ensureUserProfile(
  supabase: SupabaseServerClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const fullName = metadataString(user, 'full_name');
  const inviteCode = metadataString(user, 'manager_invite_code');
  const expectedRole = roleForEmail(user.email);

  const { data: existing } = await supabase
    .from('profiles')
    .select('id,email,full_name,role,account_status,manager_id,manager_invite_code,created_at,updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    const currentRole = normalizeRole(existing.role);
    const currentStatus = normalizeAccountStatus(existing.account_status, currentRole);
    const patch: Partial<Pick<UserProfile, 'email' | 'role' | 'account_status' | 'manager_id'>> = {};

    if (!existing.email && user.email) patch.email = user.email;

    if (expectedRole === 'master' && currentRole !== 'master') {
      patch.role = 'master';
      patch.account_status = 'active';
    }

    if (currentRole === 'client' && !existing.manager_id && inviteCode) {
      const managerId = await resolveInviteManagerId(supabase, inviteCode);
      if (managerId) {
        patch.manager_id = managerId;
        patch.account_status = 'pending_manager_approval';
      }
    }

    if (!existing.account_status) {
      patch.account_status = expectedRole === 'master' ? 'active' : 'pending_manager_assignment';
    }

    if (Object.keys(patch).length) {
      const { data: updated } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('id,email,full_name,role,account_status,manager_id,manager_invite_code,created_at,updated_at')
        .single();

      return updated
        ? ({
            ...updated,
            role: normalizeRole(updated.role),
            account_status: normalizeAccountStatus(updated.account_status, normalizeRole(updated.role))
          } as UserProfile)
        : null;
    }

    return {
      ...existing,
      role: currentRole,
      account_status: currentStatus
    } as UserProfile;
  }

  const managerId = expectedRole === 'client' ? await resolveInviteManagerId(supabase, inviteCode) : null;

  const initialStatus: AccountStatus =
    expectedRole === 'master'
      ? 'active'
      : managerId
        ? 'pending_manager_approval'
        : 'pending_manager_assignment';

  const { data: created } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email || null,
      full_name: fullName,
      role: expectedRole,
      manager_id: managerId,
      account_status: initialStatus
    })
    .select('id,email,full_name,role,account_status,manager_id,manager_invite_code,created_at,updated_at')
    .single();

  return created
    ? ({
        ...created,
        role: normalizeRole(created.role),
        account_status: normalizeAccountStatus(created.account_status, normalizeRole(created.role))
      } as UserProfile)
    : null;
}

export const getCurrentUserProfile = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    return { user: null, profile: null, supabase };
  }

  const profile = await ensureUserProfile(supabase, userResult.user);

  return {
    user: userResult.user,
    profile,
    supabase
  };
});

export async function requireUser() {
  const value = await getCurrentUserProfile();

  if (!value.user) {
    redirect('/login');
  }

  const status = accountStatus(value.profile);

  if (status === 'disabled' || status === 'suspended') {
    redirect('/account-pending');
  }

  return value;
}

export async function requireRole(role: UserRole) {
  const value = await requireUser();

  if (!canAccessRole(value.profile?.role, role)) {
    redirect(dashboardForRole(value.profile?.role));
  }

  return value;
}
