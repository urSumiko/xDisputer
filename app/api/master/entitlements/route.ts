import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { ensureUserProfile, normalizeRole } from '../../../../lib/supabase/roles';

function cleanValue(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

function parsePositiveLimit(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!normalized || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number set by Master.`);
  }
  return parsed;
}

function revalidateEntitlementViews() {
  revalidatePath('/master');
  revalidatePath('/master/accounts');
  revalidatePath('/admin');
  revalidatePath('/admin/access');
  revalidatePath('/admin/output-activity-v2');
  revalidatePath('/admin/output-queue');
  revalidatePath('/workspace');
  revalidatePath('/app');
}

function redirectBack(request: NextRequest, status: 'ok' | 'error', message?: string) {
  const fallback = new URL('/master/accounts?view=managers', request.url);
  const referer = request.headers.get('referer');
  const target = referer ? new URL(referer) : fallback;

  target.searchParams.set('control', status);
  target.searchParams.set('entitlementsSyncedAt', String(Date.now()));
  if (message) target.searchParams.set('message', message.slice(0, 180));

  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const mode = cleanValue(formData, 'mode');
    const profileId = cleanValue(formData, 'profileId');

    if (!profileId || mode !== 'manager') {
      return redirectBack(request, 'error', 'Only manager limit records can be edited here. Disputer output overrides were removed.');
    }

    const supabase = await createSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    if (!userResult.user) {
      const login = new URL('/login', request.url);
      login.searchParams.set('next', '/app');
      return NextResponse.redirect(login, 303);
    }

    const actorProfile = await ensureUserProfile(supabase, userResult.user);
    const actorRole = normalizeRole(actorProfile?.role);

    if (actorRole !== 'master') {
      return redirectBack(request, 'error', 'Only master can edit manager agreement limits.');
    }

    const maxClients = parsePositiveLimit(cleanValue(formData, 'maxClients'), 'Manager Disputer limit');
    const defaultOutputLimit = parsePositiveLimit(cleanValue(formData, 'defaultClientOutputLimit'), 'Manager default outputs per Disputer/day');
    const { error } = await supabase.rpc('access_set_manager_entitlement_v1', {
      manager_id_input: profileId,
      max_clients_input: maxClients,
      default_client_output_limit_input: defaultOutputLimit,
      notes_input: null
    });

    if (error) return redirectBack(request, 'error', error.message);
    revalidateEntitlementViews();
    return redirectBack(request, 'ok', `Manager limits synced: ${maxClients} Disputers, ${defaultOutputLimit} outputs/day.`);
  } catch (error) {
    return redirectBack(request, 'error', error instanceof Error ? error.message : 'Manager entitlement update failed.');
  }
}
