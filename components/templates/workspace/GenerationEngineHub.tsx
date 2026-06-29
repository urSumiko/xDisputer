import DynamicTemplateReleaseGatePanel from './DynamicTemplateReleaseGatePanel';
import TemplateReadinessCard from './TemplateReadinessCard';
import TemplateRenderPlanPreview from './TemplateRenderPlanPreview';
import type { DynamicTemplateExecutionModel } from '../../../lib/templates/intelligence';
import type { GenerationEnginePlan } from '../../../lib/templates/workspace/generation-engine-service';
import type { TemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';

export default function GenerationEngineHub({ context, plan, executionModel }: { context: TemplateLibraryContext; plan: GenerationEnginePlan; executionModel: DynamicTemplateExecutionModel }) {
  return <section className="template-workspace-hub" data-template-workspace-hub="engine" data-template-process="template-execution-control">
    <TemplateReadinessCard contract={context.contract} summary="Generation Engine previews renderer output, verifies preserved static text, validates canonical fields, and controls release readiness for assigned clients." action={context.nextAction} />
    <TemplateRenderPlanPreview plan={plan} />
    <DynamicTemplateReleaseGatePanel model={executionModel} />
    <section className="template-workspace-two-column">
      <article className="admin-monitor-card template-workspace-status-card"><p className="eyebrow">Release decision</p><strong>{plan.releaseAction.enabled && executionModel.ready ? 'Ready' : 'Not ready'}</strong><span>{executionModel.ready ? plan.releaseAction.reason : executionModel.blockers[0] || plan.releaseAction.reason}</span><a className={`template-workspace-next-action ${plan.releaseAction.enabled && executionModel.ready ? 'ready' : 'blocked'}`} href="/manager-workspace/engine"><span>{plan.releaseAction.label}</span><small>{plan.releaseAction.enabled && executionModel.ready ? 'Run release validation before assigning to clients.' : 'Resolve the exact issue shown by the engine.'}</small></a></article>
      <article className="admin-monitor-card template-workspace-status-card"><p className="eyebrow">Automation safety</p><strong>{plan.blockers.length || executionModel.blockers.length ? 'Locked' : 'Available'}</strong><span>Automation stays locked until preview, mapping, static text, and table rules are safe.</span><div className="template-rule-list">{plan.blockers.length ? plan.blockers.map((blocker) => <span key={blocker} className="template-workspace-inline-warning">{blocker}</span>) : <span className="template-workspace-inline-ok">No release blockers detected.</span>}</div></article>
    </section>
  </section>;
}
