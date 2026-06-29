import { requireRole } from '../../lib/saas/session';
import { requireWorkspaceAccess } from '../../lib/saas/access-entitlement';
import LetterGeneratorWorkspaceV2 from '../../components/LetterGeneratorWorkspaceV2';
import ClientOutputLimitBoundary from '../../components/ClientOutputLimitBoundary';
import ApplicationRecoveryBoundary from '../../components/ApplicationRecoveryBoundary';

export default async function WorkspacePage() {
  await requireWorkspaceAccess();
  const { user, profile } = await requireRole('client');

  return (
    <ApplicationRecoveryBoundary>
      <ClientOutputLimitBoundary>
        <LetterGeneratorWorkspaceV2 accountEmail={profile?.email || user.email || null} accountRole="client" />
      </ClientOutputLimitBoundary>
    </ApplicationRecoveryBoundary>
  );
}
