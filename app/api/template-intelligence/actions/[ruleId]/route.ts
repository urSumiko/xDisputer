import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '../../../../../lib/saas/session';
import { updateDynamicTemplateRule } from '../../../../../lib/templates/intelligence';

export async function PATCH(request: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const { ruleId } = await context.params;
  const patch = await request.json().catch(() => ({}));
  const result = await updateDynamicTemplateRule({ supabase: session.supabase, managerUserId: session.user.id, ruleId, patch });
  revalidatePath('/manager-workspace/studio');
  revalidatePath('/manager-workspace/engine');
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
