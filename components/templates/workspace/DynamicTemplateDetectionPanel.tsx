import type { DynamicTemplateInspectionResult } from '../../../lib/templates/intelligence';

function Metric({ label, value }: { label: string; value: number }) {
  return <span><b>{value}</b><small>{label}</small></span>;
}

export default function DynamicTemplateDetectionPanel({ inspection }: { inspection: DynamicTemplateInspectionResult }) {
  return <section className="admin-monitor-card dynamic-template-detection-panel" data-dynamic-template-detection-panel="true" data-dynamic-template-status={inspection.status}>
    <div className="admin-monitor-card-header"><div><p>Template intelligence</p><h2>Automated detection</h2></div><span className={`template-workspace-pill ${inspection.status === 'ready' ? 'ready' : 'attention'}`}>{inspection.status}</span></div>
    <div className="template-render-grid">
      <Metric label="Static text" value={inspection.staticTextBlocks.length} />
      <Metric label="Variables" value={inspection.variables.length} />
      <Metric label="Entities" value={inspection.entities.length} />
      <Metric label="Mapped fields" value={inspection.mappedFields.length} />
      <Metric label="Tables" value={inspection.tableLayouts.length} />
      <Metric label="Rules" value={inspection.suggestedRules.length} />
    </div>
    <div className="template-rule-list">
      {inspection.blockers.length ? inspection.blockers.map((blocker) => <span key={blocker} className="template-workspace-inline-warning">{blocker}</span>) : <span className="template-workspace-inline-ok">No critical intelligence blockers detected.</span>}
      {inspection.warnings.slice(0, 4).map((warning) => <span key={warning} className="template-workspace-inline-warning">{warning}</span>)}
    </div>
  </section>;
}
