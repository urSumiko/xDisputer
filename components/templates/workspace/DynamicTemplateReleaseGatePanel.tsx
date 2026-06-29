import type { DynamicTemplateExecutionModel } from '../../../lib/templates/intelligence';

export default function DynamicTemplateReleaseGatePanel({ model }: { model: DynamicTemplateExecutionModel }) {
  return <section className="admin-monitor-card dynamic-template-release-gate" data-dynamic-template-release-gate="true" data-dynamic-template-release-ready={model.ready ? 'true' : 'false'}>
    <div className="admin-monitor-card-header"><div><p>Release gate</p><h2>{model.ready ? 'Template can proceed' : 'Release is blocked'}</h2></div><span className={`template-workspace-pill ${model.ready ? 'ready' : 'attention'}`}>{model.rulesCount} rules</span></div>
    <div className="template-rule-list">
      {model.blockers.length ? model.blockers.map((blocker) => <span key={blocker} className="template-workspace-inline-warning">{blocker}</span>) : <span className="template-workspace-inline-ok">Dynamic template rules, mappings, parser, and renderer checks are ready.</span>}
      {model.executionModel.slice(0, 6).map((item) => <article key={item.ruleId} className={`template-rule-row ${item.status === 'blocked' ? 'blocked' : item.status === 'warning' ? 'warning' : 'valid'}`}><div><strong>{item.target}</strong><span>{item.reason}</span></div><small>{item.action}</small></article>)}
    </div>
  </section>;
}
