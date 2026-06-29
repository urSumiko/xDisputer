import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PayrollProfilePayload = {
  employmentType: 'full_time' | 'output_based';
  isOutputBased: boolean;
  isFullTime: boolean;
  managerId: string | null;
  baseSalary: number;
  perOutputRate: number;
  updatedAt: string | null;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return response;
}

function rowFrom(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data[0] as Record<string, unknown> | undefined || null;
  return data && typeof data === 'object' ? data as Record<string, unknown> : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeProfile(row: Record<string, unknown> | null, managerIdFallback: string | null = null): PayrollProfilePayload {
  const rowForType = row || {};
  const isOutputBased = rowForType.employment_type === 'output_based' || rowForType.is_regular === false || rowForType.is_output_based === true;
  const employmentType = isOutputBased ? 'output_based' : 'full_time';

  return {
    employmentType,
    isOutputBased,
    isFullTime: !isOutputBased,
    managerId: typeof rowForType.manager_id === 'string' ? rowForType.manager_id : managerIdFallback,
    baseSalary: isOutputBased ? 0 : numberValue(rowForType.base_salary ?? rowForType.salary),
    perOutputRate: numberValue(rowForType.per_output_rate ?? rowForType.rate),
    updatedAt: typeof rowForType.updated_at === 'string' ? rowForType.updated_at : null
  };
}

async function readPayrollProfileFallback(userId: string) {
  const admin = createSupabaseAdminClient();
  const profile = await admin
    .from('profiles')
    .select('manager_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile.error) return { profile: null, errorMessage: profile.error.message };

  const managerId = typeof profile.data?.manager_id === 'string' ? profile.data.manager_id : null;
  if (!managerId) return { profile: normalizeProfile(null, null), errorMessage: null };

  const setting = await admin
    .from('manager_user_settings')
    .select('employment_type,is_regular,base_salary,salary,per_output_rate,rate,updated_at')
    .eq('manager_id', managerId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (setting.error) return { profile: null, errorMessage: setting.error.message };

  return {
    profile: normalizeProfile(setting.data as Record<string, unknown> | null, managerId),
    errorMessage: null
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return noStoreJson({ error: userError?.message || 'No authenticated user.' }, { status: 401 });

  const rpc = await supabase.rpc('client_payroll_profile_v1');
  if (!rpc.error) {
    return noStoreJson({ profile: normalizeProfile(rowFrom(rpc.data)) });
  }

  const fallback = await readPayrollProfileFallback(userResult.user.id);
  if (fallback.errorMessage || !fallback.profile) {
    return noStoreJson({ error: rpc.error.message, fallbackError: fallback.errorMessage }, { status: 500 });
  }

  return noStoreJson({ profile: fallback.profile, syncWarning: rpc.error.message });
}
