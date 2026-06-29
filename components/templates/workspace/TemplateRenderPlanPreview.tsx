import type { GenerationEnginePlan } from '../../../lib/templates/workspace/generation-engine-service';

export default function TemplateRenderPlanPreview({ plan }: { plan: GenerationEnginePlan }) {
  return <section className="admin-monitor-card template-render-plan" data-template-render-plan="true" data-generation-readiness={plan.readiness}>
    <div className="admin-monitor-card-header"><div><p>Generation plan</p><h2>{plan.releaseAction.label}</h2></div><span className={`template-workspace-pill ${plan.releaseAction.enabled ? 'ready' : 'attention'}`}>{plan.readiness}</span></div>
    <div className="template-render-grid">
      <article><strong>{plan.preservedStaticText.length}</strong><span>Preserved static blocks</span></article>
      <article><strong>{plan.generatedVariables.filter((item) => item.status === 'ready').length}</strong><span>Ready variables</span></article>
      <article><strong>{plan.tablePlans.length}</strong><span>Table plans</span></article>
      <article><strong>{plan.blockers.length}</strong><span>Release issues</span></article>
    </div>
    <div className="template-rule-list">
      {plan.generatedVariables.slice(0, 8).map((variable) => <article key={`${variable.token}-${variable.canonicalField}`} className={`template-rule-row ${variable.status === 'ready' ? 'valid' : variable.status === 'conflict' ? 'warning' : 'blocked'}`}><div><strong>{variable.token}</strong><span>{variable.canonicalField}</span></div><small>{variable.status}</small></article>)}
      {!plan.generatedVariables.length ? <div className="admin-monitor-empty">No render variables are available until a template is uploaded and inspected.</div> : null}
    </div>
  </section>;
}
