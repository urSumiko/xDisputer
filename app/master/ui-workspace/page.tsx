import { redirect } from 'next/navigation';
import { requireRole } from '../../../lib/saas/session';

export default async function MasterUiWorkspacePage() {
  await requireRole('master');
  redirect('/master');
}
