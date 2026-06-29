import { createSupabaseAdminClient } from '../supabase/admin';

type SupabaseServerClient = {
  auth: {
    updateUser(input: { data: Record<string, unknown> }): Promise<{ error: { message?: string } | null }>;
  };
};

export type AccountProfileSaveResult = {
  ok: boolean;
  displayName: string | null;
  errorMessage: string | null;
  strategy: 'service-role' | 'session-rpc' | 'session-auth' | 'none';
};

export function normalizeAccountDisplayName(value: FormDataEntryValue | string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw.replace(/\s+/g, ' ').slice(0, 120);
  return normalized || null;
}

export function accountSettingsStateParam(state: 'saved' | 'error', reason?: string | null) {
  const params = new URLSearchParams({ account_settings: state });
  if (reason) params.set('account_settings_reason', reason.slice(0, 80));
  return params;
}

async function saveWithServiceRole(user: { id: string; email?: string | null }, displayName: string | null): Promise<AccountProfileSaveResult> {
  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: user.id, email: user.email || null, full_name: displayName }, { onConflict: 'id' });

  if (profileError) {
    return { ok: false, displayName, errorMessage: profileError.message, strategy: 'service-role' };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: displayName || '' }
  });

  if (authError) {
    return { ok: false, displayName, errorMessage: authError.message, strategy: 'service-role' };
  }

  return { ok: true, displayName, errorMessage: null, strategy: 'service-role' };
}

async function saveWithSessionRpc(supabase: SupabaseServerClient & { rpc?: Function }, displayName: string | null): Promise<AccountProfileSaveResult> {
  if (typeof supabase.rpc !== 'function') return { ok: false, displayName, errorMessage: 'RPC client unavailable.', strategy: 'session-rpc' };
  const { error } = await supabase.rpc('update_current_account_profile_v1', { display_name_input: displayName });
  if (error) return { ok: false, displayName, errorMessage: error.message, strategy: 'session-rpc' };
  return { ok: true, displayName, errorMessage: null, strategy: 'session-rpc' };
}

async function saveWithSessionAuth(supabase: SupabaseServerClient, displayName: string | null): Promise<AccountProfileSaveResult> {
  const { error } = await supabase.auth.updateUser({ data: { full_name: displayName || '' } });
  if (error) return { ok: false, displayName, errorMessage: error.message ?? 'Session profile update failed.', strategy: 'session-auth' };
  return { ok: true, displayName, errorMessage: null, strategy: 'session-auth' };
}

export async function saveCurrentAccountProfile(options: {
  supabase: SupabaseServerClient & { rpc?: Function };
  user: { id: string; email?: string | null };
  displayName: string | null;
}): Promise<AccountProfileSaveResult> {
  try {
    return await saveWithServiceRole(options.user, options.displayName);
  } catch (error) {
    const serviceError = error instanceof Error ? error.message : 'Service role save failed.';
    const rpcResult = await saveWithSessionRpc(options.supabase, options.displayName);
    if (rpcResult.ok) return rpcResult;
    const authResult = await saveWithSessionAuth(options.supabase, options.displayName);
    if (authResult.ok) return authResult;
    return {
      ok: false,
      displayName: options.displayName,
      errorMessage: `${serviceError}; ${rpcResult.errorMessage}; ${authResult.errorMessage}`,
      strategy: 'none'
    };
  }
}
