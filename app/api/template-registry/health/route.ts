import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

type CheckStatus = 'pass' | 'fail';

function check(name: string, status: CheckStatus, message: string) {
  return { name, status, message };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({
      status: 'fail',
      checks: [check('Authenticated user', 'fail', userError.message)]
    }, { status: 401 });
  }

  if (!userResult.user) {
    return NextResponse.json({
      status: 'fail',
      checks: [check('Authenticated user', 'fail', 'No authenticated user.')]
    }, { status: 401 });
  }

  const checks = [
    check('Authenticated user', 'pass', `Signed in as ${userResult.user.email || userResult.user.id}.`)
  ];

  const templateAssets = await supabase
    .from('template_assets')
    .select('id', { count: 'exact', head: true });

  checks.push(check(
    'template_assets table',
    templateAssets.error ? 'fail' : 'pass',
    templateAssets.error ? templateAssets.error.message : `Readable. Count: ${templateAssets.count ?? 0}.`
  ));

  const generationRuns = await supabase
    .from('generation_runs')
    .select('id', { count: 'exact', head: true });

  checks.push(check(
    'generation_runs table',
    generationRuns.error ? 'fail' : 'pass',
    generationRuns.error ? generationRuns.error.message : `Readable. Count: ${generationRuns.count ?? 0}.`
  ));

  const storageList = await supabase
    .storage
    .from('template-assets')
    .list(userResult.user.id, { limit: 1 });

  checks.push(check(
    'template-assets storage bucket',
    storageList.error ? 'fail' : 'pass',
    storageList.error ? storageList.error.message : 'Private bucket is reachable for this authenticated user.'
  ));

  const failed = checks.filter((item) => item.status === 'fail');

  return NextResponse.json({
    status: failed.length ? 'fail' : 'pass',
    checks
  }, { status: failed.length ? 500 : 200 });
}
