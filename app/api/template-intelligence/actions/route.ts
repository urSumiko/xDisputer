import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '../../../../lib/saas/session';
import { createDynamicTemplateRule, inspectAndStoreDynamicTemplate } from '../../../../lib/templates/intelligence';

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === 'string' ? payload.action : 'inspect';
  const templateAssetId = typeof payload.templateAssetId === 'string' ? payload.templateAssetId : '';
  if (!templateAssetId) return NextResponse.json({ error: 'templateAssetId is required.' }, { status: 422 });
  if (action === 'save-rule') {
    const inspectionId = typeof payload.inspectionId === 'string' ? payload.inspectionId : '';
    if (!inspectionId) return NextResponse.json({ error: 'inspectionId is required.' }, { status: 422 });
    const result = await createDynamicTemplateRule({ supabase: session.supabase, managerUserId: session.user.id, templateAssetId, inspectionId, rule: payload.rule || {} });
    revalidatePath('/manager-workspace/studio');
    revalidatePath('/manager-workspace/engine');
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }
  const result = await inspectAndStoreDynamicTemplate({ supabase: session.supabase, managerUserId: session.user.id, templateAssetId });
  revalidatePath('/manager-workspace');
  revalidatePath('/manager-workspace/studio');
  revalidatePath('/manager-workspace/engine');
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
