import { redirect } from 'next/navigation';
import { requireRole } from '../../../lib/saas/session';

export default async function MasterWorkspacesPage() {
  await requireRole('master');
  redirect('/master/accounts');
}
