import { getSessionContext } from './session';

type ConfirmStatus = 'pass' | 'warn' | 'fail';

type ConfirmCheck = {
  name: string;
  status: ConfirmStatus;
  message: string;
};

type ConfirmGroup = {
  name: string;
  checks: ConfirmCheck[];
};

function pass(name: string, message: string): ConfirmCheck {
  return { name, status: 'pass', message };
}

function warn(name: string, message: string): ConfirmCheck {
  return { name, status: 'warn', message };
}

function fail(name: string, message: string): ConfirmCheck {
  return { name, status: 'fail', message };
}

function summarize(groups: ConfirmGroup[]) {
  const checks = groups.flatMap((group) => group.checks);
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warned = checks.filter((check) => check.status === 'warn').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return {
    status: failed ? 'fail' as const : warned ? 'warn' as const : 'pass' as const,
    passed,
    warned,
    failed
  };
}

export async function confirmOperationalSetup() {
  const session = await getSessionContext();
  const groups: ConfirmGroup[] = [];

  groups.push({
    name: 'Session',
    checks: [
      session.user ? pass('Signed in', `Authenticated as ${session.user.email || session.user.id}.`) : fail('Signed in', 'No authenticated user.'),
      session.isMaster ? pass('Master access', 'Current account can inspect system setup.') : fail('Master access', 'Only the master account can run full confirmation.'),
      session.role ? pass('Resolved role', `Role resolved as ${session.role}.`) : fail('Resolved role', 'No role resolved.')
    ]
  });

  const tableChecks: ConfirmCheck[] = [];

  const templateAssets = await session.supabase
    .from('template_assets')
    .select('id, round_label, template_kind, letter_type, exhibit_kind, is_active', { count: 'exact' })
    .limit(50);

  tableChecks.push(
    templateAssets.error
      ? fail('template_assets table', templateAssets.error.message)
      : pass('template_assets table', `Readable. ${templateAssets.count ?? 0} record(s) found.`)
  );

  const generationRuns = await session.supabase
    .from('generation_runs')
    .select('id, client_name, round_label, output_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  tableChecks.push(
    generationRuns.error
      ? fail('generation_runs table', generationRuns.error.message)
      : pass('generation_runs table', `Readable. ${generationRuns.count ?? 0} generation run(s) found.`)
  );

  groups.push({ name: 'Supabase tables', checks: tableChecks });

  const storageChecks: ConfirmCheck[] = [];

  if (session.user) {
    const storageList = await session.supabase
      .storage
      .from('template-assets')
      .list(session.user.id, { limit: 1 });

    storageChecks.push(
      storageList.error
        ? fail('template-assets bucket', storageList.error.message)
        : pass('template-assets bucket', 'Private storage bucket is reachable.')
    );
  } else {
    storageChecks.push(fail('template-assets bucket', 'Cannot check storage without signed-in user.'));
  }

  groups.push({ name: 'Supabase storage', checks: storageChecks });

  const activeAssets = templateAssets.data || [];
  const rounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
  const registryChecks: ConfirmCheck[] = [];

  for (const round of rounds) {
    const activeForRound = activeAssets.filter((asset) => asset.round_label === round && asset.is_active);
    const hasDispute = activeForRound.some((asset) => asset.template_kind === 'LETTER' && asset.letter_type === 'DISPUTE');
    const hasLate = activeForRound.some((asset) => asset.template_kind === 'LETTER' && asset.letter_type === 'LATE_PAYMENT');

    registryChecks.push(
      activeForRound.length
        ? pass(`${round} registry`, `${activeForRound.length} active template asset(s).`)
        : warn(`${round} registry`, 'No active Supabase templates registered yet.')
    );

    if (hasDispute) registryChecks.push(pass(`${round} dispute letter`, 'Active dispute template found.'));
    else registryChecks.push(warn(`${round} dispute letter`, 'No active Supabase dispute template yet.'));

    if (hasLate) registryChecks.push(pass(`${round} late-payment letter`, 'Active late-payment template found.'));
    else registryChecks.push(warn(`${round} late-payment letter`, 'No active Supabase late-payment template yet.'));
  }

  groups.push({ name: 'Round template registry', checks: registryChecks });

  const latestRun = generationRuns.data?.[0];

  groups.push({
    name: 'Generation history',
    checks: [
      latestRun
        ? pass('Latest generation run', `${latestRun.client_name || 'Unknown client'} / ${latestRun.round_label} / ${latestRun.output_status}.`)
        : warn('Latest generation run', 'No generation run has been saved yet.')
    ]
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summarize(groups),
    groups
  };
}
