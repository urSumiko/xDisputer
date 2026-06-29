'use server';

import { revalidatePath } from 'next/cache';
import { joinManagerByInviteCode } from '../../lib/saas/account-management';
import { requireRole } from '../../lib/saas/session';

function valueFromForm(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export async function joinManager(formData: FormData) {
  const inviteCode = valueFromForm(formData, 'inviteCode');
  const { supabase, user } = await requireRole('client');

  await joinManagerByInviteCode(supabase, user.id, inviteCode);

  revalidatePath('/workspace');
  revalidatePath('/api/account');
}
