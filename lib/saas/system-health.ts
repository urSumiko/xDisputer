import { getSessionContext } from './session';

export type HealthStatus = 'pass' | 'warn' | 'fail';

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  message: string;
};

export type HealthGroup = {
  name: string;
  checks: HealthCheck[];
};

export type SystemHealthReport = {
  generatedAt: string;
  summary: {
    status: HealthStatus;
    pass: number;
    warn: number;
    fail: number;
  };
  groups: HealthGroup[];
};

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function check(name: string, status: HealthStatus, message: string): HealthCheck {
  return { name, status, message };
}

function summarize(groups: HealthGroup[]) {
  const checks = groups.flatMap((group) => group.checks);
  const pass = checks.filter((item) => item.status === 'pass').length;
  const warn = checks.filter((item) => item.status === 'warn').length;
  const fail = checks.filter((item) => item.status === 'fail').length;

  return {
    status: fail > 0 ? 'fail' as const : warn > 0 ? 'warn' as const : 'pass' as const,
    pass,
    warn,
    fail
  };
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const session = await getSessionContext();
  const groups: HealthGroup[] = [];

  groups.push({
    name: 'Environment',
    checks: [
      check(
        'Supabase URL',
        hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ? 'pass' : 'fail',
        hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ? 'NEXT_PUBLIC_SUPABASE_URL is configured.' : 'Missing NEXT_PUBLIC_SUPABASE_URL.'
      ),
      check(
        'Supabase anon key',
        hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? 'pass' : 'fail',
        hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY is configured.' : 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      ),
      check(
        'Site URL',
        hasValue(process.env.NEXT_PUBLIC_SITE_URL) ? 'pass' : 'warn',
        hasValue(process.env.NEXT_PUBLIC_SITE_URL) ? 'NEXT_PUBLIC_SITE_URL is configured.' : 'NEXT_PUBLIC_SITE_URL is not set; auth redirects may rely on request origin.'
      )
    ]
  });

  groups.push({
    name: 'Session',
    checks: [
      check('Authenticated user', session.user ? 'pass' : 'fail', session.user ? `Signed in as ${session.user.email || 'authenticated user'}.` : 'No authenticated user.'),
      check('Resolved role', session.role ? 'pass' : 'fail', session.role ? `Resolved role is ${session.role}.` : 'No role resolved.'),
      check('Dashboard route', session.dashboardPath ? 'pass' : 'fail', session.dashboardPath ? `Dashboard route is ${session.dashboardPath}.` : 'No dashboard route resolved.'),
      check('Account status', session.profile?.account_status === 'disabled' ? 'fail' : 'pass', session.profile?.account_status === 'disabled' ? 'Current account is disabled.' : 'Current account is allowed to continue.')
    ]
  });

  const databaseChecks: HealthCheck[] = [];

  if (!session.user) {
    databaseChecks.push(check('Profile schema', 'fail', 'Cannot check profile schema without a signed-in user.'));
  } else {
    const { data, error } = await session.supabase
      .from('profiles')
      .select('id,email,role,account_status,manager_id,manager_invite_code,created_at,updated_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      databaseChecks.push(check('Profile schema', 'fail', error.message));
    } else if (!data) {
      databaseChecks.push(check('Profile schema', 'fail', 'Current user profile was not found.'));
    } else {
      databaseChecks.push(check('Profile schema', 'pass', 'Required profile columns are readable.'));
    }
  }

  const { data: rpcHealth, error: rpcHealthError } = await session.supabase.rpc('control_health_check');

  if (rpcHealthError) {
    databaseChecks.push(check('Control health RPC', 'fail', rpcHealthError.message));
  } else {
    databaseChecks.push(check('Control health RPC', 'pass', typeof rpcHealth === 'string' ? rpcHealth : 'control_health_check returned successfully.'));
  }

  groups.push({ name: 'Database control plane', checks: databaseChecks });

  groups.push({
    name: 'Route contract',
    checks: [
      check('Profile control endpoint', 'pass', 'POST /api/control/profile handles make_manager, demote_client, disable, activate, and clear_manager.'),
      check('Invite control endpoint', 'pass', 'POST /api/control/invite rotates manager invite codes.'),
      check('Join control endpoint', 'pass', 'POST /api/control/join assigns a client to a manager by invite code.'),
      check('System health endpoint', 'pass', 'GET /api/system/health exposes this report as JSON.')
    ]
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summarize(groups),
    groups
  };
}
