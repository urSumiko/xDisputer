import { redirect } from 'next/navigation';
import TemplateStudioHub from '../../../components/templates/workspace/TemplateStudioHub';
import TemplateWorkspaceShell from '../../../components/templates/workspace/TemplateWorkspaceShell';
import { requireAuth } from '../../../lib/saas/session';
import { inspectDynamicTemplateFromAsset, classifyFindingsToRules } from '../../../lib/templates/intelligence';
import { getManagerTemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';
import { inspectTemplateStructure } from '../../../lib/templates/workspace/template-studio-service';
import { buildTemplateWorkflowFramework } from '../../../lib/templates/workspace/template-workflow-framework';

export default async function ManagerTemplateStudioPage() {
  const session = await requireAuth();
  if (!session.isManager && !session.isMaster) redirect(session.dashboardPath);
  const [context, inspection] = await Promise.all([
    getManagerTemplateLibraryContext({ supabase: session.supabase, managerId: session.user.id }),
    inspectTemplateStructure({ supabase: session.supabase, managerId: session.user.id })
  ]);
  const asset = context.latestAsset ? { ...context.latestAsset, manager_user_id: session.user.id, round_label: context.activeRound } : { id: 'draft-template', manager_user_id: session.user.id, round_label: context.activeRound, original_filename: 'draft-template', validation_json: null };
  const intelligence = inspectDynamicTemplateFromAsset(asset);
  const intelligenceRules = classifyFindingsToRules({ findings: intelligence.suggestedRules, managerUserId: session.user.id, templateAssetId: intelligence.templateAssetId, inspectionId: 'preview-inspection' });
  const workflowFramework = buildTemplateWorkflowFramework({ context, structure: inspection, intelligence, dynamicRules: intelligenceRules });

  return <TemplateWorkspaceShell session={session} activeHref="/manager-workspace/studio" title="Template Studio" description="Authoring hub for parser rules, canonical mappings, variables, preservation logic, and layout rules.">
    <TemplateStudioHub context={context} inspection={inspection} intelligence={intelligence} intelligenceRules={intelligenceRules} workflowFramework={workflowFramework} />
  </TemplateWorkspaceShell>;
}
