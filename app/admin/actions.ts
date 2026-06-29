'use server';

import { revalidatePath } from 'next/cache';
import { joinManagerByInviteCode, rotateManagerInviteCode, updateManagedAccount } from '../../lib/saas/account-management';
import { requireRole } from '../../lib/saas/session';
import type { AccountStatus } from '../../lib/supabase/roles';

function valueFromForm(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

async function updateClientStatus(formData: FormData, account_status: AccountStatus) {
  const targetProfileId = valueFromForm(formData, 'profileId');
  const { supabase, user } = await requireRole('manager');

  await updateManagedAccount(supabase, {
    actorUserId: user.id,
    actorRole: 'manager',
    targetProfileId,
    nextStatus: account_status
  });

  revalidatePath('/admin');
  revalidatePath('/api/account');
}

export async function activateClientAccount(formData: FormData) {
  await updateClientStatus(formData, 'active');
}

export async function disableClientAccount(formData: FormData) {
  await updateClientStatus(formData, 'disabled');
}

export async function rotateInviteCode() {
  const { supabase, user } = await requireRole('manager');
  await rotateManagerInviteCode(supabase, user.id);
  revalidatePath('/admin');
  revalidatePath('/api/account');
}

export async function joinManager(formData: FormData) {
  const inviteCode = valueFromForm(formData, 'inviteCode');
  const { supabase, user } = await requireRole('client');
  await joinManagerByInviteCode(supabase, user.id, inviteCode);
  revalidatePath('/workspace');
  revalidatePath('/api/account');
}
