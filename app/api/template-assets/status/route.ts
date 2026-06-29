import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../../lib/manager-template-scope';

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];

function scopeError(error: unknown) {
  if (error instanceof ManagerTemplateScopeError) {
    return NextResponse.json({ error: error.message, code: error.code, category: 'MANAGER_TEMPLATE' }, { status: error.code === 'NO_AUTH' ? 401 : 403 });
  }
  return NextResponse.json({ error: 'Could not resolve manager template scope.', category: 'MANAGER_TEMPLATE' }, { status: 500 });
}

function slotKey(asset: { template_kind: string; letter_type: string | null; exhibit_kind: string | null }) {
  return asset.template_kind === 'LETTER' ? `LETTER:${asset.letter_type || ''}` : `EXHIBIT:${asset.exhibit_kind || ''}`;
}

export async function GET(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;

  const session = await getSessionContext();
  if (!session.user) return NextResponse.json({ error: 'No authenticated user.' }, { status: 401 });

  let scope;
  try {
    scope = await resolveManagerTemplateScope(session);
  } catch (error) {
    return scopeError(error);
  }

  const round = request.nextUrl.searchParams.get('round') || '';
  let query = session.supabase
    .from('template_assets')
    .select('id, manager_user_id, uploaded_by_user_id, round_label, template_kind, letter_type, exhibit_kind, original_filename, mime_type, file_size, content_hash, version_number, is_active, storage_bucket, storage_path, updated_at, validation_json')
    .eq('manager_user_id', scope.managerUserId)
    .eq('is_active', true)
    .order('round_label', { ascending: true })
    .order('template_kind', { ascending: true })
    .order('version_number', { ascending: false });

  if (round) {
    if (!allowedRounds.includes(round)) return NextResponse.json({ error: 'Invalid round.' }, { status: 400 });
    query = query.eq('round_label', round);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message, category: 'MANAGER_TEMPLATE' }, { status: 500 });

  const assets = data || [];
  const slots = Object.fromEntries(assets.map((asset) => [slotKey(asset), {
    active: true,
    assetId: asset.id,
    filename: asset.original_filename,
    round: asset.round_label,
    version: asset.version_number,
    contentHash: asset.content_hash,
    updatedAt: asset.updated_at,
    storageBucket: asset.storage_bucket,
    storagePath: asset.storage_path,
    usedByClientGeneration: true
  }]));

  return NextResponse.json({
    status: 'ok',
    managerTemplateScope: managerTemplateScopePayload(scope),
    activeAssetCount: assets.length,
    assets,
    slots,
    generationContract: {
      source: 'MANAGER_TEMPLATE_ASSET',
      fileRoute: '/api/template-assets/file',
      resolver: 'resolveManagerTemplateFile',
      clientGenerationUsesActiveManagerSlots: true
    }
  });
}
