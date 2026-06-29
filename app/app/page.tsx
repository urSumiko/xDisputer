import { redirect } from 'next/navigation';
import { requireAuth } from '../../lib/saas/session';

export default async function AppRoute() {
  const session = await requireAuth();
  redirect(session.dashboardPath);
}
