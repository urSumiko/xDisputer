import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/saas/session';
import { workspaceAccessErrorResponse } from '../../../../lib/saas/access-entitlement';
import { ManagerTemplateScopeError, resolveManagerTemplateScope } from '../../../../lib/manager-template-scope';
import { createSupabaseAdminClient } from '../../../../lib/supabase/admin';
import { downloadManagerTemplateObject } from '../../../../lib/supabase/template-storage-service';

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;

function tableClient(session: SessionContext) {
  try { return createSupabaseAdminClient() as SessionContext['supabase']; }
  catch { return session.supabase; }
}

function errorJson(message: string, status = 400) {
  return NextResponse.json({ status: 'error', message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const accessError = await workspaceAccessErrorResponse();
    if (accessError) return accessError;
    const session = await getSessionContext();
    if (!session.user) return errorJson('No authenticated user.', 401);
    const scope = await resolveManagerTemplateScope(session);
    const assetId = request.nextUrl.searchParams.get('assetId')?.trim();
    if (!assetId) return errorJson('Template asset id is required.');

    const result = await tableClient(session)
      .from('template_assets')
      .select('id, manager_user_id, storage_bucket, storage_path, original_filename, mime_type')
      .eq('id', assetId)
      .eq('manager_user_id', scope.managerUserId)
      .eq('is_active', true)
      .single();

    if (result.error || !result.data) return errorJson(result.error?.message || 'Template file was not found.', 404);
    if (!result.data.storage_path) return errorJson('Template file storage path is missing.', 404);

    const file = await downloadManagerTemplateObject({ sessionSupabase: session.supabase, bucket: result.data.storage_bucket || 'template-assets', path: result.data.storage_path });
    if (file.error || !file.data) return errorJson(file.error?.message || 'Template file could not be read.', 500);

    return new Response(file.data, {
      headers: {
        'Content-Type': result.data.mime_type || 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    if (error instanceof ManagerTemplateScopeError) return errorJson(error.message, error.code === 'NO_AUTH' ? 401 : 403);
    return errorJson(error instanceof Error ? error.message : 'Template file request failed.', 500);
  }
}
