import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { latestTemplateAssetsBySlot, templateAssetSlotKey } from '../../../../lib/supabase/template-registry';
import { managerTemplateScopePayload, resolveManagerTemplateScope, ManagerTemplateScopeError } from '../../../../lib/manager-template-scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allowedRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'];

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  return response;
}

function managerScopeError(error: unknown) {
  if (error instanceof ManagerTemplateScopeError) {
    return noStoreJson({ error: error.message, code: error.code, category: 'MANAGER_TEMPLATE' }, { status: error.code === 'NO_AUTH' ? 401 : 403 });
  }

  return noStoreJson({ error: 'Could not resolve manager template scope.', category: 'MANAGER_TEMPLATE' }, { status: 500 });
}

function assetFileUrl(asset: {
  round_label: string;
  template_kind: string;
  letter_type: string | null;
  exhibit_kind: string | null;
}) {
  const params = new URLSearchParams();
  params.set('round', asset.round_label);
  params.set('templateKind', asset.template_kind);

  if (asset.template_kind === 'LETTER' && asset.letter_type) {
    params.set('letterType', asset.letter_type);
  }

  if (asset.template_kind === 'EXHIBIT' && asset.exhibit_kind) {
    params.set('exhibitKind', asset.exhibit_kind);
  }

  return `/api/template-assets/file?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const accessError = await workspaceAccessErrorResponse();
  if (accessError) return accessError;

  const session = await getSessionContext();

  if (!session.user) {
    return noStoreJson({ error: 'No authenticated user.' }, { status: 401 });
  }

  let scope;
  try {
    scope = await resolveManagerTemplateScope(session);
  } catch (error) {
    return managerScopeError(error);
  }

  const round = request.nextUrl.searchParams.get('round');

  if (round && !allowedRounds.includes(round)) {
    return noStoreJson({ error: 'Invalid round.' }, { status: 400 });
  }

  let query = session.supabase
    .from('template_assets')
    .select('id, manager_user_id, uploaded_by_user_id, template_scope, round_label, template_kind, letter_type, exhibit_kind, original_filename, mime_type, file_size, contract_json, validation_json, content_hash, version_number, updated_at, created_at')
    .eq('manager_user_id', scope.managerUserId)
    .eq('is_active', true)
    .order('round_label', { ascending: true })
    .order('template_kind', { ascending: true })
    .order('version_number', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (round) query = query.eq('round_label', round);

  const { data, error } = await query;

  if (error) return noStoreJson({ error: error.message }, { status: 500 });

  const activeAssets = latestTemplateAssetsBySlot(data || []);
  const duplicateActiveSlotCount = Math.max(0, (data || []).length - activeAssets.length);

  const assets = activeAssets.map((asset) => ({
    ...asset,
    source: 'MANAGER_TEMPLATE_ASSET',
    manager_user_id: asset.manager_user_id || scope.managerUserId,
    cache_key: `${asset.id}:${asset.version_number || 0}:${asset.updated_at || asset.created_at || ''}:${asset.content_hash || ''}`,
    slot_key: templateAssetSlotKey(asset),
    file_url: assetFileUrl(asset)
  }));

  const slots = assets.reduce<Record<string, (typeof assets)[number]>>((accumulator, asset) => {
    accumulator[asset.slot_key] = asset;
    return accumulator;
  }, {});

  return noStoreJson({
    manifest: {
      ownerId: scope.managerUserId,
      managerUserId: scope.managerUserId,
      requesterUserId: scope.requesterUserId,
      templateScope: managerTemplateScopePayload(scope),
      round: round || null,
      generatedAt: new Date().toISOString(),
      duplicateActiveSlotCount,
      assets,
      slots
    },
    assets
  });
}
