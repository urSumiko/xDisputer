import { redirect } from 'next/navigation';
import GenerationEngineHub from '../../../components/templates/workspace/GenerationEngineHub';
import TemplateWorkspaceShell from '../../../components/templates/workspace/TemplateWorkspaceShell';
import { requireAuth } from '../../../lib/saas/session';
import { buildDynamicTemplateExecutionModel } from '../../../lib/templates/intelligence';
import { previewGenerationPlan } from '../../../lib/templates/workspace/generation-engine-service';
import { getManagerTemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';

export default async function ManagerGenerationEnginePage() {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);
  const context = await getManagerTemplateLibraryContext({ supabase: session.supabase, managerId: session.user.id });
  const [plan, executionModel] = await Promise.all([
    previewGenerationPlan({ supabase: session.supabase, managerId: session.user.id, templateId: context.contract.activeTemplateId }),
    context.contract.activeTemplateId
      ? buildDynamicTemplateExecutionModel({ supabase: session.supabase, managerUserId: session.user.id, templateAssetId: context.contract.activeTemplateId })
      : Promise.resolve({ templateAssetId: 'draft-template', managerUserId: session.user.id, clientId: null, inspectionId: null, rulesCount: 0, executionModel: [], blockers: ['No active template asset is available for dynamic rule validation.'], warnings: [], ready: false })
  ]);

  return <TemplateWorkspaceShell
    session={session}
    activeHref="/manager-workspace/engine"
    title="Generation Engine"
    description="Preview, validate, and diagnose dynamic template output before release."
  >
    <GenerationEngineHub context={context} plan={plan} executionModel={executionModel} />
  </TemplateWorkspaceShell>;
}
