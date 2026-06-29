import { getSessionContext } from './session';

type Status = 'pass' | 'warn' | 'fail';

type RuntimeCheck = {
  name: string;
  status: Status;
  message: string;
};

type RuntimeGroup = {
  name: string;
  checks: RuntimeCheck[];
};

const rounds = ['1st Round', '2nd Round', '3rd Round', 'Final'] as const;
const letterTypes = ['DISPUTE', 'LATE_PAYMENT'] as const;
const exhibitKinds = ['FCRA', 'ATTACHMENT', 'AFFIDAVIT', 'FTC'] as const;

function pass(name: string, message: string): RuntimeCheck {
  return { name, status: 'pass', message };
}

function warn(name: string, message: string): RuntimeCheck {
  return { name, status: 'warn', message };
}

function fail(name: string, message: string): RuntimeCheck {
  return { name, status: 'fail', message };
}

function summarize(groups: RuntimeGroup[]) {
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

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function confirmRuntimeBridge() {
  const session = await getSessionContext();
  const groups: RuntimeGroup[] = [];

  groups.push({
    name: 'Runtime environment',
    checks: [
      hasEnv('NEXT_PUBLIC_SUPABASE_URL')
        ? pass('Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL is configured.')
        : fail('Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL is missing.'),
      hasEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        ? pass('Supabase anon key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is configured.')
        : fail('Supabase anon key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.'),
      hasEnv('NEXT_PUBLIC_SITE_URL')
        ? pass('Site URL', 'NEXT_PUBLIC_SITE_URL is configured.')
        : warn('Site URL', 'NEXT_PUBLIC_SITE_URL is not configured. Auth redirects may rely on request origin.')
    ]
  });

  groups.push({
    name: 'Authenticated session',
    checks: [
      session.user
        ? pass('Signed in user', `Signed in as ${session.user.email || session.user.id}.`)
        : fail('Signed in user', 'No authenticated user.'),
      session.role
        ? pass('Resolved role', `Role resolved as ${session.role}.`)
        : fail('Resolved role', 'No role was resolved.'),
      session.isMaster
        ? pass('Master access', 'Master account can inspect runtime bridge.')
        : warn('Master access', 'Current account is not master. Some system checks may be limited.')
    ]
  });

  const tableChecks: RuntimeCheck[] = [];

  const templateAssets = await session.supabase
    .from('template_assets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);

  tableChecks.push(
    templateAssets.error
      ? fail('template_assets table', templateAssets.error.message)
      : pass('template_assets table', `Readable. ${templateAssets.count ?? 0} template record(s) found.`)
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

  const assets = templateAssets.data || [];
  const registryChecks: RuntimeCheck[] = [];

  for (const round of rounds) {
    const active = assets.filter((asset) => asset.round_label === round && asset.is_active);

    registryChecks.push(
      active.length
        ? pass(`${round} active registry`, `${active.length} active template asset(s).`)
        : warn(`${round} active registry`, 'No active templates registered for this round.')
    );

    for (const letterType of letterTypes) {
      const found = active.some((asset) => asset.template_kind === 'LETTER' && asset.letter_type === letterType);
      registryChecks.push(
        found
          ? pass(`${round} ${letterType}`, 'Active letter template found.')
          : warn(`${round} ${letterType}`, 'No active Supabase letter template yet.')
      );
    }

    for (const exhibitKind of exhibitKinds) {
      const found = active.some((asset) => asset.template_kind === 'EXHIBIT' && asset.exhibit_kind === exhibitKind);
      registryChecks.push(
        found
          ? pass(`${round} ${exhibitKind}`, 'Active exhibit template found.')
          : warn(`${round} ${exhibitKind}`, 'No active Supabase exhibit template yet.')
      );
    }
  }

  groups.push({ name: 'Template registry coverage', checks: registryChecks });

  const storageChecks: RuntimeCheck[] = [];

  if (assets.length) {
    const firstAsset = assets.find((asset) => asset.is_active) || assets[0];

    const download = await session.supabase.storage
      .from(firstAsset.storage_bucket || 'template-assets')
      .download(firstAsset.storage_path);

    storageChecks.push(
      download.error
        ? fail('Template file download', download.error.message)
        : pass('Template file download', `Downloaded ${firstAsset.original_filename} from private storage.`)
    );
  } else {
    storageChecks.push(warn('Template file download', 'No template assets exist yet, so file download was not tested.'));
  }

  groups.push({ name: 'Supabase storage', checks: storageChecks });

  groups.push({
    name: 'Generation history',
    checks: [
      generationRuns.data?.[0]
        ? pass('Latest generation run', `${generationRuns.data[0].client_name || 'Unknown client'} / ${generationRuns.data[0].round_label} / ${generationRuns.data[0].output_status}.`)
        : warn('Latest generation run', 'No generation run has been saved yet.')
    ]
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summarize(groups),
    groups
  };
}
