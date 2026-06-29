import AccessAuditView from '../../../components/AccessAuditView';
import { listAccessAuditEvents } from '../../../lib/saas/access-audit';
import { requireRole } from '../../../lib/saas/session';

const MANAGER_AUDIT_LIMIT = 60;

export default async function AdminAuditPage() {
  const { user, profile, supabase } = await requireRole('manager');
  const result = await listAccessAuditEvents(supabase, 'manager', MANAGER_AUDIT_LIMIT);

  return <AccessAuditView scope="manager" accountEmail={profile?.email || user.email || 'Manager account'} events={result.events} errorMessage={result.errorMessage} />;
}
