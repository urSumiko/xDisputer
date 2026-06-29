import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '../../../../lib/saas/session';
import { inspectAndStoreDynamicTemplate } from '../../../../lib/templates/intelligence';

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const templateAssetId = typeof payload.templateAssetId === 'string' ? payload.templateAssetId : '';
  if (!templateAssetId) return NextResponse.json({ error: 'templateAssetId is required.' }, { status: 422 });
  const result = await inspectAndStoreDynamicTemplate({ supabase: session.supabase, managerUserId: session.user.id, templateAssetId });
  revalidatePath('/manager-workspace');
  revalidatePath('/manager-workspace/studio');
  revalidatePath('/manager-workspace/engine');
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
