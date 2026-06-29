import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

export async function GET(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;

  const session = await getSessionContext();

  if (!session.user) {
    return noStoreJson({ error: 'No authenticated user.' }, { status: 401 });
  }

  const cleanupOnly = request.nextUrl.searchParams.get('cleanupOnly') === 'true';
  const limitInput = Number(request.nextUrl.searchParams.get('limit') || 100);
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.trunc(limitInput), 1), 500) : 100;

  let query = session.supabase
    .from('template_asset_retention_candidates_v1')
    .select('*')
    .eq('owner_id', session.user.id)
    .order('cleanup_candidate', { ascending: false })
    .order('archived_at', { ascending: false })
    .limit(limit);

  if (cleanupOnly) query = query.eq('cleanup_candidate', true);

  const { data, error } = await query;

  if (error) {
    return noStoreJson({ error: error.message }, { status: 500 });
  }

  const candidates = data || [];

  return noStoreJson({
    ownerId: session.user.id,
    cleanupOnly,
    limit,
    count: candidates.length,
    cleanupCandidateCount: candidates.filter((item) => item.cleanup_candidate).length,
    candidates
  });
}
