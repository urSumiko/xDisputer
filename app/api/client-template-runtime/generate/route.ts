import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '../../../../lib/saas/session';
import { generateClientLettersFromManagerTemplate } from '../../../../lib/client-template-runtime';

export async function POST() {
  const session = await requireAuth();
  const result = await generateClientLettersFromManagerTemplate({ supabase: session.supabase, clientUserId: session.user.id });
  revalidatePath('/workspace');
  revalidatePath('/output');
  revalidatePath('/packets');
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
