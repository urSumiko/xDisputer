import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/saas/session';
import { getClientTemplateRuntimeContext } from '../../../../lib/client-template-runtime';

export async function GET() {
  const session = await requireAuth();
  const context = await getClientTemplateRuntimeContext({ supabase: session.supabase, clientUserId: session.user.id });
  return NextResponse.json(context);
}
