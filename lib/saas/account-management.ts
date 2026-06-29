import type { AccountStatus, UserProfile, UserRole } from '../supabase/roles';
import { createSupabaseServerClient } from '../supabase/server';

export type ManagedAccount = Pick<
  UserProfile,
  'id' | 'email' | 'full_name' | 'role' | 'account_status' | 'manager_id' | 'manager_invite_code' | 'created_at' | 'updated_at'
>;
export type ManagementScope = 'master' | 'manager' | 'admin';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type AccountMutation = {
  actorUserId: string;
  actorRole: ManagementScope;
  targetProfileId: string;
  nextRole?: Exclude<UserRole, 'master' | 'admin'>;
  nextStatus?: AccountStatus;
  nextManagerId?: string | null;
};

const profileSelect = 'id,email,full_name,role,account_status,manager_id,manager_invite_code,created_at,updated_at';

function normalizeAccount(row: ManagedAccount): ManagedAccount {
  return {
    ...row,
    role: row.role === 'admin' ? 'manager' : row.role,
    account_status: row.account_status || 'active'
  };
}

export function generateInviteCode(seed: string) {
  const raw = `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `MGR-${Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 8)}`;
}

export async function listManagedAccounts(supabase: SupabaseServerClient, scope: ManagementScope, actorUserId?: string) {
  let query = supabase
    .from('profiles')
    .select(profileSelect)
    .order('created_at', { ascending: false });

  if (scope === 'admin' || scope === 'manager') {
    query = query.eq('role', 'client').eq('manager_id', actorUserId || '');
  }

  const { data, error } = await query;

  return {
    accounts: Array.isArray(data) ? (data as ManagedAccount[]).map(normalizeAccount) : [],
    errorMessage: error?.message || null
  };
}

export async function updateManagedAccount(supabase: SupabaseServerClient, input: AccountMutation) {
  const targetProfileId = input.targetProfileId.trim();

  if (!targetProfileId) throw new Error('Missing target profile id.');

  const { data, error } = await supabase.rpc('control_update_profile', {
    target_profile_id: targetProfileId,
    next_role: input.nextRole || null,
    next_status: input.nextStatus || null,
    next_manager_id: typeof input.nextManagerId === 'undefined' ? null : input.nextManagerId,
    clear_manager: typeof input.nextManagerId !== 'undefined' && input.nextManagerId === null
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Account update did not return a profile row.');

  return normalizeAccount(data as ManagedAccount);
}

export async function ensureManagerInviteCode(supabase: SupabaseServerClient, managerId: string) {
  const modern = await supabase.rpc('access_ensure_manager_invite_code', {
    target_manager_id: managerId
  });

  if (!modern.error && modern.data) return String(modern.data);

  const legacy = await supabase.rpc('control_ensure_manager_invite_code');

  if (legacy.error) throw new Error(modern.error?.message || legacy.error.message);
  if (!legacy.data) throw new Error('Manager invite code was not returned.');

  return String(legacy.data);
}

export async function rotateManagerInviteCode(supabase: SupabaseServerClient, managerId: string) {
  const modern = await supabase.rpc('access_rotate_manager_invite_code');

  if (!modern.error && modern.data) return String(modern.data);

  const legacy = await supabase.rpc('control_rotate_manager_invite_code');

  if (legacy.error) throw new Error(modern.error?.message || legacy.error.message);
  if (!legacy.data) throw new Error('Manager invite code was not returned.');

  return String(legacy.data);
}

export async function joinManagerByInviteCode(supabase: SupabaseServerClient, clientId: string, inviteCode: string) {
  const code = inviteCode.trim().toUpperCase();
  if (!code) throw new Error('Invite code is required.');

  const { data, error } = await supabase.rpc('control_join_manager', {
    invite_code: code
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not assign client to manager.');

  return normalizeAccount(data as ManagedAccount);
}
