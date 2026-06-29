import { redirect } from 'next/navigation';
import TemplateLibraryHub from '../../components/templates/workspace/TemplateLibraryHub';
import TemplateWorkspaceShell from '../../components/templates/workspace/TemplateWorkspaceShell';
import { requireAuth } from '../../lib/saas/session';
import { getManagerTemplateLibraryContext } from '../../lib/templates/workspace/template-library-service';

export default async function ManagerWorkspacePage() {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);
  const context = await getManagerTemplateLibraryContext({ supabase: session.supabase, managerId: session.user.id });

  return <TemplateWorkspaceShell
    session={session}
    activeHref="/manager-workspace"
    title="Template Library"
    description="Source-of-truth hub for manager-owned templates, round versions, readiness, and client/disputer sync."
  >
    <TemplateLibraryHub context={context} />
  </TemplateWorkspaceShell>;
}
