import { requireRole } from '../../lib/saas/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('manager');
  return <>{children}</>;
}
