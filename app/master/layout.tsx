import { requireRole } from '../../lib/saas/session';

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  await requireRole('master');
  return <>{children}</>;
}
