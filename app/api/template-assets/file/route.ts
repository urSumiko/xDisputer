import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../../lib/manager-template-scope';
import { downloadManagerTemplateObject } from '../../../../lib/supabase/template-storage-service';
import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];
const allowedLetterTypes = ['DISPUTE', 'LATE_PAYMENT'];
const allowedExhibitKinds = ['FCRA', 'AFFIDAVIT', 'ATTACHMENT', 'FTC'];

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;

function templateReadClient(session: SessionContext) {
  try { return { supabase: createSupabaseAdminClient() as SessionContext['supabase'], mode: 'service-role' as const, warning: null as string | null }; }
  catch (error) { return { supabase: session.supabase, mode: 'session-rls' as const, warning: error instanceof Error ? error.message : 'Service role unavailable; using session RLS fallback.' }; }
}

function privateTemplateCacheHeaders(input: { etag: string; filename: string; mimeType: string | null; managerUserId: string; readMode: string }): Record<string, string> {
  return {
    'Content-Type': input.mimeType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${input.filename.replace(/"/g, '')}"`,
    'x-template-file-name': input.filename,
    'x-template-source': 'MANAGER_TEMPLATE_ASSET',
    'x-template-manager-user-id': input.managerUserId,
    'x-template-read-mode': input.readMode,
    'ETag': input.etag,
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
  };
}

function managerScopeError(error: unknown) {
  if (error instanceof ManagerTemplateScopeError) {
    return NextResponse.json({ error: error.message, code: error.code, category: 'MANAGER_TEMPLATE' }, { status: error.code === 'NO_AUTH' ? 401 : 403 });
  }

  return NextResponse.json({ error: 'Could not resolve manager template scope.', category: 'MANAGER_TEMPLATE' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;

  const session = await getSessionContext();
  if (!session.user) return NextResponse.json({ error: 'No authenticated user.' }, { status: 401 });

  const round = request.nextUrl.searchParams.get('round') || '';
  const templateKind = request.nextUrl.searchParams.get('templateKind') || '';
  const letterType = request.nextUrl.searchParams.get('letterType') || '';
  const exhibitKind = request.nextUrl.searchParams.get('exhibitKind') || '';

  if (!allowedRounds.includes(round)) return NextResponse.json({ error: 'Invalid round.' }, { status: 400 });

  let scope;
  try {
    scope = await resolveManagerTemplateScope(session);
  } catch (error) {
    return managerScopeError(error);
  }

  const readClient = templateReadClient(session);
  let query = readClient.supabase
    .from('template_assets')
    .select('*')
    .eq('manager_user_id', scope.managerUserId)
    .eq('round_label', round)
    .eq('template_kind', templateKind)
    .eq('is_active', true)
    .order('version_number', { ascending: false })
    .limit(1);

  if (templateKind === 'LETTER') {
    if (!allowedLetterTypes.includes(letterType)) return NextResponse.json({ error: 'Invalid letter type.' }, { status: 400 });
    query = query.eq('letter_type', letterType);
  } else if (templateKind === 'EXHIBIT') {
    if (!allowedExhibitKinds.includes(exhibitKind)) return NextResponse.json({ error: 'Invalid exhibit kind.' }, { status: 400 });
    query = query.eq('exhibit_kind', exhibitKind);
  } else {
    return NextResponse.json({ error: 'Invalid template kind.' }, { status: 400 });
  }

  const { data: asset, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message, readMode: readClient.mode, warning: readClient.warning }, { status: 500 });
  if (!asset) {
    return NextResponse.json({
      error: 'Manager template is missing.',
      message: 'Your assigned manager has not uploaded the required active template for this round and document slot.',
      category: 'MANAGER_TEMPLATE',
      managerTemplateScope: managerTemplateScopePayload(scope),
      readMode: readClient.mode,
      warning: readClient.warning
    }, { status: 404 });
  }

  const etag = `"template-${asset.id}-${asset.version_number}-${asset.updated_at}"`;
  const headers = privateTemplateCacheHeaders({ etag, filename: asset.original_filename, mimeType: asset.mime_type, managerUserId: scope.managerUserId, readMode: readClient.mode });

  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  const download = await downloadManagerTemplateObject({ sessionSupabase: session.supabase, bucket: asset.storage_bucket || 'template-assets', path: asset.storage_path });
  if (download.error || !download.data) return NextResponse.json({ error: download.error?.message || 'Template file could not be loaded.', category: 'MANAGER_TEMPLATE', readMode: readClient.mode, warning: readClient.warning }, { status: 500 });
  headers['x-template-storage-mode'] = download.mode;

  return new Response(download.data, { headers });
}
